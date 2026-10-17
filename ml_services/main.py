import logging
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field, field_validator

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


@app.get("/health")
def health():
    return {"status": "ok", "models": ["complaint_classifier", "fine_risk_model"]}


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
    features = pd.DataFrame(
        [data.model_dump()],
        columns=[
            "fines_3m",
            "amount_3m",
            "distinct_types_3m",
            "unpaid_count",
            "unpaid_amount",
            "avg_days_to_pay",
        ],
    )
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
