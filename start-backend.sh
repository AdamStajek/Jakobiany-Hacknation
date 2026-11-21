# Backend only in docker (http://localhost:8000); run the frontend locally with live reload:
#   cd frontend && npm start   -> http://localhost:4200
docker compose down -v && docker compose up --build -d backend
