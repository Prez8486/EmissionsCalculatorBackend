# EmissionsCalculatorBackend

## Run Project

### Ensure dependencies are up to date

```sh
npm install 
```

### Run Project

```sh
npm start 
```

## AI Python Microservice 

### Setup virtual environment 

```sh
python -m venv venv 
```

### Activate virtual environment 

```sh
.\venv\Scripts\Activate 
```

### Install all libraries 

```sh
pip install -r requirements.txt 
```

### Start the AI Service (both options viable) 

```sh
python -m app.main
```

```sh
uvicorn app.test:app –reload 
```

### Start the AI Service (both options viable) Sending Packages for Testing 

```sh
curl -X GET http://127.0.0.1:8000/health 
curl -X GET http://127.0.0.1:8000/health 
curl -X POST http://127.0.0.1:8000/predict \    -H "Content-Type: application/json" \ 

    -d '{ 

          "accelerometer": [0.1, -0.2, 9.8], 

          "gyroscope": [0.01, 0.02, 0.03], 

          "gps": [37.7749, -122.4194], 

          "barometer": 1013.25 

        }' 

curl -X POST http://localhost:5000/api/ai/predict -H "Content-Type: application/json" -d "@mock_v2_payload_600.json" 
```
