import pandas as pd
import numpy as np
import random
from datetime import datetime, timedelta

# Set fixed seeds for reproducibility
np.random.seed(42)
random.seed(42)

NUM_STUDENTS = 300
NUM_ALLOCATED = 240

# --- 1. PERSONAS & STUDENTS ---
# Personas drive questionnaire answers and fine probabilities
personas = {
    "Studious Early Bird": {"q1": [1, 2], "q2": [1, 2], "q3": [4, 5], "q4": ["silent", "library"], "q5": [3, 4], "q6": ["veg", "egg"], "q7": [1, 2], "q8": [1, 2], "q9": ["hostel", "home"], "q10": [1, 2], "fine_multiplier": 0.2},
    "Social Night Owl": {"q1": [3, 4], "q2": [3, 4], "q3": [2, 3], "q4": ["music", "group"], "q5": [1, 2], "q6": ["nonveg", "egg"], "q7": [4, 5], "q8": [4, 5], "q9": ["out"], "q10": [4, 5], "fine_multiplier": 1.5},
    "Messy Gamer": {"q1": [4], "q2": [4], "q3": [1, 2], "q4": ["silent", "music"], "q5": [1, 2], "q6": ["nonveg"], "q7": [3, 4], "q8": [2, 3], "q9": ["hostel"], "q10": [2, 3], "fine_multiplier": 2.0},
    "Balanced Average": {"q1": [2, 3], "q2": [2, 3], "q3": [3, 4], "q4": ["group", "library"], "q5": [2, 3], "q6": ["veg", "nonveg"], "q7": [3], "q8": [3], "q9": ["home", "hostel"], "q10": [3], "fine_multiplier": 0.8},
}

students_data = []
for i in range(1, NUM_STUDENTS + 1):
    gender = random.choice(["M", "M", "F"]) # 2:1 Male to Female ratio
    block = random.choice(["A", "B"]) if gender == "M" else "C"
    persona_name = random.choice(list(personas.keys()))
    p = personas[persona_name]
    
    # Hidden risk factor (0.5 to 1.5)
    hidden_risk = random.uniform(0.5, 1.5)
    
    student = {
        "student_id": i,
        "gender": gender,
        "block_number": block,
        "true_persona": persona_name,
        "q1": random.choice(p["q1"]),
        "q2": random.choice(p["q2"]),
        "q3": random.choice(p["q3"]),
        "q4": random.choice(p["q4"]),
        "q5": random.choice(p["q5"]),
        "q6": random.choice(p["q6"]),
        "q7": random.choice(p["q7"]),
        "q8": random.choice(p["q8"]),
        "q9": random.choice(p["q9"]),
        "q10": random.choice(p["q10"]),
        "_base_fine_prob": p["fine_multiplier"] * hidden_risk
    }
    students_data.append(student)

df_students = pd.DataFrame(students_data)
# Save version for clustering (no fine probs)
df_students.drop(columns=['_base_fine_prob']).to_csv("students.csv", index=False)

# --- 2. ALLOCATION ---
allocations = []
allocated_students = random.sample(students_data, NUM_ALLOCATED)
blocks = {"A": [], "B": [], "C": []}

# Generate valid room numbers (5 floors, 15 rooms each = 101-115, 201-215...)
for floor in range(1, 6):
    for room in range(1, 16):
        for b in ["A", "B", "C"]:
            blocks[b].append(f"{floor}{room:02d}")

for s in allocated_students:
    b = s["block_number"]
    room = random.choice(blocks[b])
    allocations.append({"student_id": s["student_id"], "room_number": room, "block_number": b})

df_alloc = pd.DataFrame(allocations)
df_alloc.to_csv("allocation.csv", index=False)

# --- 3. COMPLAINTS (Text NLP Data) ---
categories = {
    "Plumbing": ["water leaking from", "tap is broken in", "no hot water", "drain is blocked"],
    "Electrical": ["sparking from socket", "fan not working", "lights are flickering", "AC is dead"],
    "WiFi": ["internet is too slow", "router not connecting", "wifi drops frequently"],
    "Cleanliness": ["corridor is dirty", "garbage not collected", "washroom stinks"],
    "Furniture": ["chair is broken", "bed frame making noise", "cupboard lock jammed"],
    "Mess": ["food was cold", "found insect in dal", "insufficient plates"],
    "Discipline": ["seniors making noise", "loud music from next room", "people smoking"],
    "Other": ["lost my keys", "need pest control", "stray dog in campus"]
}

complaints_data = []
start_date = datetime(2023, 8, 1)

for i in range(1500):
    cat = random.choice(list(categories.keys()))
    template = random.choice(categories[cat])
    urgency = random.choice(["", " please fix asap!", " urgent.", " it is a hazard."])
    text = f"{template}{urgency}"
    
    # Priority logic
    priority = "low"
    if "urgent" in text.lower() or "sparking" in text.lower() or "hazard" in text.lower():
        priority = "high"
    elif random.random() > 0.5:
        priority = "medium"
        
    # Introduce 8% label noise (for ML robustness grading)
    if random.random() < 0.08:
        cat = random.choice(list(categories.keys()))
        
    alloc = random.choice(allocations)
    created = start_date + timedelta(days=random.randint(0, 365), hours=random.randint(0, 23))
    
    complaints_data.append({
        "student_id": alloc["student_id"],
        "room_number": alloc["room_number"],
        "block_number": alloc["block_number"],
        "description": text,
        "category": cat,
        "priority": priority,
        "created_at": created.strftime("%Y-%m-%d %H:%M:%S")
    })

pd.DataFrame(complaints_data).to_csv("complaints.csv", index=False)

# --- 4. FINES ---
fine_types = {
    1: {"name": "Late entry", "base": 100},
    2: {"name": "Noise violation", "base": 200},
    3: {"name": "Untidy room", "base": 150},
    4: {"name": "Unauthorized guest", "base": 500},
    5: {"name": "Property damage", "base": 1000} # Variable in reality, fixed base here
}
df_fine_types = pd.DataFrame([{"fine_type_id": k, **v} for k, v in fine_types.items()])
df_fine_types.to_csv("fine_types.csv", index=False)

fines_data = []
fine_id_counter = 1

for student in df_students.to_dict('records'):
    # Generate fines over a 12 month period (Aug to July)
    for month in range(1, 13):
        # Probability of getting a fine this month depends on persona & hidden risk
        prob = student["_base_fine_prob"] * 0.1 
        
        # Add specific logic (e.g. late bedtimes -> late entry)
        if student["q1"] >= 3: prob += 0.15 # Late bedtime
        if student["q3"] <= 2: prob += 0.10 # Low tidiness
        
        while random.random() < prob:
            # Determine fine type based on answers
            if student["q1"] >= 3 and random.random() < 0.5: ft = 1
            elif student["q3"] <= 2 and random.random() < 0.5: ft = 3
            elif student["q8"] >= 4 and random.random() < 0.5: ft = random.choice([2, 4])
            else: ft = random.choice(list(fine_types.keys()))
                
            amount = fine_types[ft]["base"]
            if ft == 5: amount = random.choice([500, 1000, 1500, 2000])
            
            # Dates
            issue_date = start_date + timedelta(days=(month-1)*30 + random.randint(0, 28))
            due_date = issue_date + timedelta(days=14)
            
            # Payment logic (messy/late people pay later)
            paid = random.random() > 0.2 # 80% chance it's paid
            if paid:
                delay = random.randint(1, 30) if student["q3"] <= 2 else random.randint(1, 10)
                paid_on = (issue_date + timedelta(days=delay)).strftime("%Y-%m-%d")
                status = "paid"
            else:
                paid_on = None
                status = "unpaid"
                
            fines_data.append({
                "fine_id": fine_id_counter,
                "student_id": student["student_id"],
                "fine_type_id": ft,
                "amount": amount,
                "issued_on": issue_date.strftime("%Y-%m-%d"),
                "due_date": due_date.strftime("%Y-%m-%d"),
                "paid_on": paid_on,
                "status": status
            })
            fine_id_counter += 1
            prob *= 0.5 # Diminishing returns for multiple fines in one month

df_fines = pd.DataFrame(fines_data)
df_fines.to_csv("fines.csv", index=False)

# --- 5. FINE RISK PREDICTION (Rolling 3-month windows) ---
# Create a monthly timeline for every student
records = []
df_fines['issued_on'] = pd.to_datetime(df_fines['issued_on'])

for student_id in df_students['student_id']:
    s_fines = df_fines[df_fines['student_id'] == student_id]
    
    for month_idx in range(4, 13): # Can only predict from month 4 onwards (needs 3mo history)
        cutoff_date = start_date + timedelta(days=(month_idx-1)*30)
        start_window = cutoff_date - timedelta(days=90)
        end_target = cutoff_date + timedelta(days=30)
        
        # History (past 3 months)
        hist = s_fines[(s_fines['issued_on'] >= start_window) & (s_fines['issued_on'] < cutoff_date)]
        
        # Target (next 1 month)
        target = s_fines[(s_fines['issued_on'] >= cutoff_date) & (s_fines['issued_on'] < end_target)]
        will_be_fined = 1 if len(target) > 0 else 0
        
        # Features
        fines_3m = len(hist)
        amount_3m = hist['amount'].sum()
        distinct_types_3m = hist['fine_type_id'].nunique()
        
        unpaid = hist[hist['status'] == 'unpaid']
        unpaid_count = len(unpaid)
        unpaid_amount = unpaid['amount'].sum()
        
        paid_hist = hist[hist['status'] == 'paid']
        if len(paid_hist) > 0:
            paid_hist.loc[:, 'days_to_pay'] = (pd.to_datetime(paid_hist['paid_on']) - paid_hist['issued_on']).dt.days
            avg_days_to_pay = paid_hist['days_to_pay'].mean()
        else:
            avg_days_to_pay = 0
            
        records.append({
            "student_id": student_id,
            "month": month_idx,
            "fines_3m": fines_3m,
            "amount_3m": amount_3m,
            "distinct_types_3m": distinct_types_3m,
            "unpaid_count": unpaid_count,
            "unpaid_amount": unpaid_amount,
            "avg_days_to_pay": round(avg_days_to_pay, 1),
            "will_be_fined": will_be_fined
        })

df_risk = pd.DataFrame(records)
df_risk.to_csv("fine_risk.csv", index=False)

print("✅ Synthetic datasets generated successfully!")