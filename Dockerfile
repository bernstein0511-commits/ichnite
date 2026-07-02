FROM python:3.10-buster

ENV PYTHONUNBUFFERED=1

WORKDIR /src

COPY backend/api/requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

COPY . .

WORKDIR /src/backend/api

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]