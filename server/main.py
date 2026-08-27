from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from intelligence import router as intelligence_router
from context import router as context_router
from routers import farms, fields, onboarding

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(intelligence_router)
app.include_router(context_router)
app.include_router(fields.router)
app.include_router(onboarding.router)
app.include_router(farms.router)


@app.get("/")
def root():
    return {"message": "Hello from FastAPI"}


@app.get("/api/hello")
def hello():
    return {"message": "Hello from TerraVision backend"}
