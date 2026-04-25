from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

from streaming import sse_stream
from vapi.outbound import router as demo_router
from vapi.webhooks import router as vapi_router

app = FastAPI(title="Scammer's Mirror API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(vapi_router)
app.include_router(demo_router)


@app.get("/healthz")
async def healthz() -> dict[str, bool]:
    return {"ok": True}


@app.get("/events")
async def events():
    return await sse_stream()
