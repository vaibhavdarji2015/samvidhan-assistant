from fastapi import FastAPI
import os
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager

from api.routes import chat, upload, document
from services.rag import init_vector_store, cleanup_vector_store

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("Starting up: Initializing FAISS Vector Store...")
    init_vector_store()
    yield
    print("Shutting down: Cleaning up memory resources...")
    cleanup_vector_store()

app = FastAPI(
    lifespan=lifespan,
    title="The Samvidhan Assistant API",
    description="Backend for Constitutional Rights & Civic Issue Resolution in Ahmedabad"
)

# Ensure static directory exists
os.makedirs("static/generated", exist_ok=True)
app.mount("/static", StaticFiles(directory="static"), name="static")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "https://samvidhan-assistant-a2d34.web.app"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Attach the cleanly separated routes
app.include_router(chat.router)
app.include_router(upload.router)
app.include_router(document.router)