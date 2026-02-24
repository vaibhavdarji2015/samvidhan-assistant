from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

# Import your routers
from api.routes import chat, upload, document

# Import your initialization logic
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

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    # Ensure your Firebase hosting domain is here!
    allow_origins=[
        "http://localhost:5173", 
        "https://tensile-splice-457106-j7.web.app"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Attach the cleanly separated routes
app.include_router(chat.router)
app.include_router(upload.router)
app.include_router(document.router)