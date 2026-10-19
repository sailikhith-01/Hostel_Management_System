import sys
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_health():
    res = client.get('/health')
    assert res.status_code == 200
    assert res.json()['status'] == 'ok'
    print('[PASS] /health OK')

def test_complaint_classification():
    res = client.post('/ml/classify-complaint', json={'description': 'The bathroom tap is leaking continuously'})
    assert res.status_code == 200
    data = res.json()
    assert 'category' in data
    assert 'confidence' in data
    assert data['category'] == 'Plumbing'
    print(f"[PASS] /ml/classify-complaint OK (Category: {data['category']}, Confidence: {data['confidence']:.2f})")

def test_fine_risk_batch():
    batch = [
        {
            'fines_3m': i % 5,
            'amount_3m': float((i % 5) * 200),
            'distinct_types_3m': (i % 2) + 1,
            'unpaid_count': i % 3,
            'unpaid_amount': float((i % 3) * 150),
            'avg_days_to_pay': float((i % 10) + 1),
        }
        for i in range(100)
    ]
    res = client.post('/ml/predict-fine-risk/batch', json={'items': batch})
    assert res.status_code == 200
    data = res.json()
    assert len(data['predictions']) == 100
    print(f"[PASS] /ml/predict-fine-risk/batch OK (Processed {len(data['predictions'])} items)")

def test_roommate_matching():
    students = [
        {
            'student_id': i + 1,
            'gender': 'M' if i % 2 == 0 else 'F',
            'q1_bedtime': (i % 4) + 1,
            'q2_wakeup': ((i + 1) % 4) + 1,
            'q3_tidiness': (i % 5) + 1,
            'q4_study_style': ['silent', 'music', 'group', 'library'][i % 4],
            'q5_study_hours': (i % 4) + 1,
            'q6_food': ['veg', 'nonveg', 'egg'][i % 3],
            'q7_noise_tolerance': (i % 5) + 1,
            'q8_visitors_social': (i % 5) + 1,
            'q9_weekends': ['hostel', 'home', 'out'][i % 3],
            'q10_share_belongings': (i % 5) + 1,
        }
        for i in range(50)
    ]
    res = client.post('/ml/match-roommates', json={'students': students})
    assert res.status_code == 200
    data = res.json()
    assert len(data['clusters']) == 50
    assert data['cluster_count'] == 4
    print(f"[PASS] /ml/match-roommates OK (Clustered {len(data['clusters'])} students into {data['cluster_count']} clusters)")

if __name__ == '__main__':
    test_health()
    test_complaint_classification()
    test_fine_risk_batch()
    test_roommate_matching()
    print('\nAll ML microservice tests passed successfully!')
