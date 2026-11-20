from fastapi import FastAPI

app = FastAPI()


@app.get("/api/hello")
def hello() -> dict[str, str]:
    return {"message": "Hello from FastAPI!"}
