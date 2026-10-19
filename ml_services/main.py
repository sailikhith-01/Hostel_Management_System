import logging
import warnings
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field, field_validator
from sklearn.exceptions import InconsistentVersionWarning

# Suppress unpickling version warnings for clean server logs
warnings.filterwarnings("ignore", category=InconsistentVersionWarning)
warnings.filterwarnings("ignore", category=UserWarning)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

MODEL_DIR = Path(__file__).resolve().parent / "models"


def load_model(filename: str):
    model_path = MODEL_DIR / filename
    if not model_path.is_file():
        raise RuntimeError(f"Required ML model is missing: {model_path}")
    try:
        return joblib.load(model_path)
    except Exception as error:
        raise RuntimeError(f"Could not load required ML model: {model_path}") from error


complaint_model = load_model("complaint_classifier.pkl")
fine_risk_model = load_model("fine_risk_model.pkl")
roommate_kmeans = load_model("roommate_kmeans.pkl")
roommate_scaler = load_model("roommate_scaler.pkl")

app = FastAPI(title="Hostel Management ML Microservice", version="1.0")


class ComplaintInput(BaseModel):
    description: str = Field(min_length=1, max_length=5000)

    @field_validator("description")
    @classmethod
    def description_must_not_be_blank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("description must not be blank")
        return value


class FineRiskInput(BaseModel):
    fines_3m: int = Field(ge=0)
    amount_3m: float = Field(ge=0, allow_inf_nan=False)
    distinct_types_3m: int = Field(ge=0)
    unpaid_count: int = Field(ge=0)
    unpaid_amount: float = Field(ge=0, allow_inf_nan=False)
    avg_days_to_pay: float = Field(ge=0, allow_inf_nan=False)


class FineRiskBatchInput(BaseModel):
    items: list[FineRiskInput] = Field(min_length=1, max_length=50000)


class RoommatePreference(BaseModel):
    student_id: int = Field(gt=0)
    gender: str = Field(pattern="^[MF]$")
    q1_bedtime: int = Field(ge=1, le=4)
    q2_wakeup: int = Field(ge=1, le=4)
    q3_tidiness: int = Field(ge=1, le=5)
    q4_study_style: str = Field(pattern="^(silent|music|group|library)$")
    q5_study_hours: int = Field(ge=1, le=4)
    q6_food: str = Field(pattern="^(veg|nonveg|egg)$")
    q7_noise_tolerance: int = Field(ge=1, le=5)
    q8_visitors_social: int = Field(ge=1, le=5)
    q9_weekends: str = Field(pattern="^(hostel|home|out)$")
    q10_share_belongings: int = Field(ge=1, le=5)


class RoommateMatchInput(BaseModel):
    students: list[RoommatePreference] = Field(min_length=1)


@app.get("/health")
def health():
    return {"status": "ok", "models": ["complaint_classifier", "fine_risk_model", "roommate_kmeans"]}


@app.post("/ml/classify-complaint")
def classify_complaint(data: ComplaintInput):
    try:
        prediction = complaint_model.predict([data.description])[0]
        probabilities = complaint_model.predict_proba([data.description])[0]
        confidence = float(np.max(probabilities))
        return {"category": str(prediction), "confidence": confidence}
    except Exception as error:
        logger.exception("Complaint classification failed")
        raise HTTPException(status_code=500, detail="Complaint classification failed") from error


@app.post("/ml/predict-fine-risk")
def predict_fine_risk(data: FineRiskInput):
    features = pd.DataFrame([data.model_dump()])
    try:
        class_labels = list(fine_risk_model.classes_)
        if 1 not in class_labels:
            raise ValueError("Fine-risk model does not contain the positive class 1")
        positive_class_index = class_labels.index(1)
        probability = float(fine_risk_model.predict_proba(features)[0][positive_class_index])
        risk_band = "High" if probability > 0.6 else ("Medium" if probability > 0.3 else "Low")
        return {"probability": probability, "risk_band": risk_band}
    except Exception as error:
        logger.exception("Fine-risk prediction failed")
        raise HTTPException(status_code=500, detail="Fine-risk prediction failed") from error


@app.post("/ml/predict-fine-risk/batch")
def predict_fine_risk_batch(data: FineRiskBatchInput):
    features = pd.DataFrame([item.model_dump() for item in data.items])
    try:
        class_labels = list(fine_risk_model.classes_)
        if 1 not in class_labels:
            raise ValueError("Fine-risk model does not contain the positive class 1")
        positive_class_index = class_labels.index(1)
        probabilities = fine_risk_model.predict_proba(features)[:, positive_class_index]
        return {
            "predictions": [
                {
                    "probability": float(probability),
                    "risk_band": "High" if probability > 0.6 else ("Medium" if probability > 0.3 else "Low"),
                }
                for probability in probabilities
            ]
        }
    except Exception as error:
        logger.exception("Batch fine-risk prediction failed")
        raise HTTPException(status_code=500, detail="Batch fine-risk prediction failed") from error


@app.post("/ml/match-roommates")
def match_roommates(data: RoommateMatchInput):
    # The K-Means roommate clustering scaler was fitted on the 7 numeric survey questions:
    # ['q1', 'q2', 'q3', 'q5', 'q7', 'q8', 'q10']
    feature_columns = ["q1", "q2", "q3", "q5", "q7", "q8", "q10"]
    rows = []
    seen_student_ids = set()

    for student in data.students:
        if student.student_id in seen_student_ids:
            raise HTTPException(status_code=422, detail="student_id values must be unique")
        seen_student_ids.add(student.student_id)
        rows.append({
            "q1": student.q1_bedtime,
            "q2": student.q2_wakeup,
            "q3": student.q3_tidiness,
            "q5": student.q5_study_hours,
            "q7": student.q7_noise_tolerance,
            "q8": student.q8_visitors_social,
            "q10": student.q10_share_belongings,
        })

    try:
        features_df = pd.DataFrame(rows, columns=feature_columns)
        scaled_features = roommate_scaler.transform(features_df)
        labels = roommate_kmeans.predict(scaled_features)
        return {
            "clusters": [
                {"student_id": student.student_id, "cluster_id": int(label)}
                for student, label in zip(data.students, labels)
            ],
            "cluster_count": int(roommate_kmeans.n_clusters),
        }
    except Exception as error:
        logger.exception("Roommate matching failed")
        raise HTTPException(status_code=500, detail="Roommate matching failed") from error
