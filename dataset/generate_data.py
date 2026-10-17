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
personas = {
    "Studious Early Bird": {"q1": [1, 2], "q2": [1, 2], "q3": [4, 5], "q4": ["silent", "library"], "q5": [3, 4], "q6": ["veg", "egg"], "q7": [1, 2], "q8": [1, 2], "q9": ["hostel", "home"], "q10": [1, 2], "fine_multiplier": 0.2},
    "Social Night Owl": {"q1": [3, 4], "q2": [3, 4], "q3": [2, 3], "q4": ["music", "group"], "q5": [1, 2], "q6": ["nonveg", "egg"], "q7": [4, 5], "q8": [4, 5], "q9": ["out"], "q10": [4, 5], "fine_multiplier": 1.5},
    "Messy Gamer": {"q1": [4], "q2": [4], "q3": [1, 2], "q4": ["silent", "music"], "q5": [1, 2], "q6": ["nonveg"], "q7": [3, 4], "q8": [2, 3], "q9": ["hostel"], "q10": [2, 3], "fine_multiplier": 2.0},
    "Balanced Average": {"q1": [2, 3], "q2": [2, 3], "q3": [3, 4], "q4": ["group", "library"], "q5": [2, 3], "q6": ["veg", "nonveg"], "q7": [3], "q8": [3], "q9": ["home", "hostel"], "q10": [3], "fine_multiplier": 0.8},
}

mens_blocks = [chr(i) for i in range(ord('A'), ord('T') + 1)] # A to T
ladies_blocks = [chr(i) for i in range(ord('A'), ord('I') + 1)] + ['S'] # A to I, plus S

students_data = []
for i in range(1, NUM_STUDENTS + 1):
    gender = random.choice(["M", "M", "F"]) # 2:1 Male to Female ratio
    block = random.choice(mens_blocks) if gender == "M" else random.choice(ladies_blocks)
    persona_name = random.choice(list(personas.keys()))
    p = personas[persona_name]
    
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
df_students.drop(columns=['_base_fine_prob']).to_csv("students.csv", index=False)

# --- 2. ROOMS & ALLOCATIONS ---
# Room sharing capacities: 1, 2, 3, 4, 6, 8
capacities = [1, 2, 3, 4, 6, 8]
allocations = []
allocated_students = random.sample(students_data, NUM_ALLOCATED)

for s in allocated_students:
    b = s["block_number"]
    floor = random.randint(1, 4)
    room_num = random.randint(1, 15)
    room_number = f"{floor}{room_num:02d}"
    capacity = random.choice(capacities)
    
    allocations.append({
        "student_id": s["student_id"], 
        "room_number": room_number, 
        "block_number": b,
        "room_capacity": capacity
    })

df_alloc = pd.DataFrame(allocations)
df_alloc.to_csv("allocation.csv", index=False)

# --- 3. COMPLAINTS (NLP Data) ---
categories = {
    "Plumbing": ["water leaking from tap", "drain is blocked", "no hot water"],
    "Electrical": ["sparking from heavy appliance socket", "fan not working", "lights flickering"],
    "WiFi": ["internet is too slow", "router not connecting"],
    "Cleanliness": ["corridor is dirty", "garbage not collected"],
    "Furniture": ["chair is broken", "bed frame making noise"],
    "Mess": ["food was cold", "found insect in plate"],
    "Discipline": ["seniors making noise", "loud music"],
    "Other": ["lost my keys", "pest control needed"]
}

complaints_data = []
start_date = datetime(2023, 8, 1)

for i in range(1500):
    cat = random.choice(list(categories.keys()))
    template = random.choice(categories[cat])
    text = f"{template} please fix."
    
    priority = "high" if "sparking" in text or "hazard" in text else random.choice(["low", "medium"])
    if random.random() < 0.08: cat = random.choice(list(categories.keys())) # 8% noise
    
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

# --- 4. FINES (Strictly 2 Fine Types) ---
fine_types = {
    1: {"name": "Late entry", "base_amount": 100},
    2: {"name": "Heavy electric appliances fine", "base_amount": 500}
}
pd.DataFrame([{"fine_type_id": k, **v} for k, v in fine_types.items()]).to_csv("fine_types.csv", index=False)

fines_data = []
fine_id_counter = 1

for student in df_students.to_dict('records'):
    for month in range(1, 13):
        prob = student["_base_fine_prob"] * 0.1
        if student["q1"] >= 3: prob += 0.15
        
        while random.random() < prob:
            ft = random.choice([1, 2])
            amount = fine_types[ft]["base_amount"]
            
            issue_date = start_date + timedelta(days=(month-1)*30 + random.randint(0, 28))
            due_date = issue_date + timedelta(days=14)
            
            status = "paid" if random.random() > 0.2 else "unpaid"
            paid_on = (issue_date + timedelta(days=random.randint(1, 10))).strftime("%Y-%m-%d") if status == "paid" else None
            
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
            prob *= 0.5

df_fines = pd.DataFrame(fines_data)
df_fines.to_csv("fines.csv", index=False)

# --- 5. FINE RISK PREDICTION (Rolling 3-month windows) ---
records = []
df_fines['issued_on'] = pd.to_datetime(df_fines['issued_on'])

for student_id in df_students['student_id']:
    s_fines = df_fines[df_fines['student_id'] == student_id]
    
    for month_idx in range(4, 13):
        cutoff_date = start_date + timedelta(days=(month_idx-1)*30)
        start_window = cutoff_date - timedelta(days=90)
        end_target = cutoff_date + timedelta(days=30)
        
        hist = s_fines[(s_fines['issued_on'] >= start_window) & (s_fines['issued_on'] < cutoff_date)]
        target = s_fines[(s_fines['issued_on'] >= cutoff_date) & (s_fines['issued_on'] < end_target)]
        
        records.append({
            "student_id": student_id,
            "month": month_idx,
            "fines_3m": len(hist),
            "amount_3m": hist['amount'].sum(),
            "distinct_types_3m": hist['fine_type_id'].nunique(),
            "unpaid_count": len(hist[hist['status'] == 'unpaid']),
            "unpaid_amount": hist[hist['status'] == 'unpaid']['amount'].sum(),
            "avg_days_to_pay": 5.0 if len(hist) > 0 else 0.0,
            "will_be_fined": 1 if len(target) > 0 else 0
        })

pd.DataFrame(records).to_csv("fine_risk.csv", index=False)
print("✅ Updated datasets generated successfully!")