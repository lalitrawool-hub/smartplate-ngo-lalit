from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, UploadFile, File, Form
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import HTMLResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import jwt
import httpx
from math import radians, cos, sin, asin, sqrt
import base64
import json
from google.oauth2 import id_token
from google.auth.transport import requests

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Configuration
JWT_SECRET = os.environ.get('JWT_SECRET', 'smartplate-secret-key')
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24

# Google OAuth
GOOGLE_CLIENT_ID = os.environ.get('GOOGLE_CLIENT_ID')
GOOGLE_CLIENT_SECRET = os.environ.get('GOOGLE_CLIENT_SECRET')

# Create the main app
app = FastAPI(title="SmartPlate API", version="1.0.0")

# Add session middleware for OAuth
app.add_middleware(SessionMiddleware, secret_key=JWT_SECRET)

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Security
security = HTTPBearer()

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)
ADMIN_EMAILS = {
    "lalit.rawool045@gmail.com",
    "lalit.rawool046@gmail.com"
}


# ============ PYDANTIC MODELS ============

class UserBase(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: str
    name: str
    picture: Optional[str] = None
    role: Optional[str] = None  # ngo, donor, volunteer, admin
    phone: Optional[str] = None
    phone_verified: bool = False
    email_verified: bool = True
    is_verified: bool = False
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    picture: Optional[str] = None
    role: Optional[str] = None
    phone: Optional[str] = None
    phone_verified: bool = False
    email_verified: bool = True
    is_verified: bool = False
    is_active: bool = True

class NGOVerification(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    organization_name: str
    registration_number: str
    address: str
    city: str
    state: str
    pincode: str
    website: Optional[str] = None
    description: Optional[str] = None
    location: Dict[str, float]  # {lat, lng}
    documents: List[str] = []  # URLs of uploaded documents
    status: str = "pending"  # pending, approved, rejected
    rejection_reason: Optional[str] = None
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class VolunteerVerification(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    id_document: Optional[str] = None  # URL of uploaded ID
    transport_mode: Optional[str] = None  # bike, auto, car, walk
    status: str = "pending"  # pending, approved, rejected
    rejection_reason: Optional[str] = None
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    delivery_count: int = 0
    performance_score: float = 5.0
    badges: List[str] = []
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class FoodRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    ngo_id: str
    ngo_name: str
    food_type: str  # cooked, packaged, raw, mixed
    quantity: int  # number of servings
    urgency_level: str = "medium"  # low, medium, high, critical
    ai_urgency_score: Optional[float] = None
    description: Optional[str] = None
    location: Dict[str, float]  # {lat, lng}
    address: str
    status: str = "pending"  # pending, approved, active, fulfilled, cancelled
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None
    fulfilled_quantity: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    expires_at: Optional[datetime] = None

class DonorFulfillment(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    request_id: str
    donor_id: str
    donor_name: str
    donor_type: Optional[str] = None
    quantity: int
    food_condition: str  # fresh, cooked, packed
    availability_time: datetime
    food_photo: Optional[str] = None
    geo_tag: Optional[Dict[str, float]] = None
    delivery_method: str  # self, volunteer
    delivered: bool = False
    status: str = "pending"  # pending, accepted, picked_up, delivered, confirmed
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Delivery(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    fulfillment_id: str
    request_id: str
    donor_id: str
    ngo_id: str
    volunteer_id: Optional[str] = None
    additional_volunteers: List[str] = []
    pickup_location: Dict[str, float]
    pickup_address: str
    dropoff_location: Dict[str, float]
    dropoff_address: str
    status: str = "pending"  # pending, assigned, picked_up, in_transit, delivered, confirmed
    delivery_proof: Optional[str] = None
    extra_volunteer_required: bool = False
    notes: Optional[str] = None
    picked_up_at: Optional[datetime] = None
    delivered_at: Optional[datetime] = None
    confirmed_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class AdminApproval(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    action_type: str  # ngo_approval, volunteer_approval, user_ban, ai_override, rule_change
    target_id: str
    target_type: str  # user, ngo, volunteer, request
    admin_a_id: Optional[str] = None
    admin_a_approved: bool = False
    admin_a_timestamp: Optional[datetime] = None
    admin_b_id: Optional[str] = None
    admin_b_approved: bool = False
    admin_b_timestamp: Optional[datetime] = None
    final_status: str = "pending"  # pending, approved, rejected
    reason: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class AnalyticsMetric(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    metric_type: str  # meals_delivered, people_fed, ngos_served, delivery_success_rate
    value: float
    period: str  # daily, weekly, monthly, all_time
    date: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# ============ HELPER FUNCTIONS ============

def create_jwt_token(user_id: str, email: str, role: Optional[str] = None) -> str:
    payload = {
        "user_id": user_id,
        "email": email,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def verify_jwt_token(token: str) -> Dict[str, Any]:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> Dict[str, Any]:
    token = credentials.credentials
    payload = verify_jwt_token(token)
    user = await db.users.find_one({"id": payload["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

async def require_role(required_roles: List[str], user: Dict = Depends(get_current_user)) -> Dict:
    if user.get("role") not in required_roles:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    return user

def haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate the great circle distance in km between two points."""
    lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
    c = 2 * asin(sqrt(a))
    r = 6371  # Radius of earth in kilometers
    return c * r

# ============ ROOT ENDPOINT ============

@app.get("/")
async def root():
    """Root endpoint - API welcome message"""
    return {
        "message": "Welcome to SmartPlate API",
        "version": "1.0.0",
        "status": "running",
        "endpoints": {
            "api_base": "/api/",
            "documentation": "/docs",
            "health": "/api/analytics/public",
            "admin": "/admin"
        }
    }

# ============ ADMIN PAGE ============

@app.get("/admin", response_class=HTMLResponse)
async def admin_page():
    """Admin dashboard page"""
    return """
    <!DOCTYPE html>
    <html>
    <head>
        <title>SmartPlate Admin Dashboard</title>
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; }
            .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
            header { background: white; padding: 20px; margin-bottom: 20px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
            h1 { color: #333; margin-bottom: 10px; }
            .auth-section { background: white; padding: 30px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); text-align: center; }
            .auth-section h2 { color: #333; margin-bottom: 20px; }
            .btn { background: #007bff; color: white; padding: 12px 24px; border: none; border-radius: 6px; cursor: pointer; font-size: 16px; margin: 10px; }
            .btn:hover { background: #0056b3; }
            .token-input { width: 100%; max-width: 500px; padding: 12px; margin: 10px 0; border: 1px solid #ddd; border-radius: 6px; font-family: monospace; }
            .dashboard { display: none; }
            .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-top: 20px; }
            .stat-card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
            .stat-card h3 { color: #666; font-size: 14px; margin-bottom: 10px; text-transform: uppercase; }
            .stat-card .value { color: #007bff; font-size: 32px; font-weight: bold; }
            .tabs { display: flex; gap: 10px; margin: 20px 0; border-bottom: 2px solid #eee; }
            .tab { padding: 12px 20px; cursor: pointer; border: none; background: none; font-size: 16px; color: #666; border-bottom: 3px solid transparent; }
            .tab.active { color: #007bff; border-bottom-color: #007bff; }
            .tab-content { display: none; }
            .tab-content.active { display: block; }
            .list { background: white; padding: 20px; border-radius: 8px; }
            .item { padding: 15px; border-bottom: 1px solid #eee; }
            .item:last-child { border-bottom: none; }
            .logout-btn { background: #dc3545; margin-top: 20px; }
            .logout-btn:hover { background: #c82333; }
        </style>
    </head>
    <body>
        <div class="container">
            <header>
                <h1>🍽️ SmartPlate Admin Dashboard</h1>
                <p style="color: #666;">Manage food redistribution platform</p>
            </header>

            <div id="authSection" class="auth-section">
                <h2>Admin Authentication Required</h2>
                <p style="color: #666; margin-bottom: 20px;">Enter your JWT token to access the dashboard</p>
                <input type="password" id="tokenInput" class="token-input" placeholder="Paste your JWT token here...">
                <button class="btn" onclick="loginWithToken()">Login</button>
            </div>

            <div id="dashboard" class="dashboard">
                <button class="btn logout-btn" onclick="logout()">Logout</button>

                <div class="stats-grid" id="statsContainer">
                    <div class="stat-card">
                        <h3>Total Users</h3>
                        <div class="value" id="totalUsers">-</div>
                    </div>
                    <div class="stat-card">
                        <h3>Verified NGOs</h3>
                        <div class="value" id="totalNGOs">-</div>
                    </div>
                    <div class="stat-card">
                        <h3>Active Volunteers</h3>
                        <div class="value" id="totalVolunteers">-</div>
                    </div>
                    <div class="stat-card">
                        <h3>Registered Donors</h3>
                        <div class="value" id="totalDonors">-</div>
                    </div>
                    <div class="stat-card">
                        <h3>Pending NGO Verifications</h3>
                        <div class="value" id="pendingNGOs">-</div>
                    </div>
                    <div class="stat-card">
                        <h3>Pending Volunteer Verifications</h3>
                        <div class="value" id="pendingVolunteers">-</div>
                    </div>
                    <div class="stat-card">
                        <h3>Active Requests</h3>
                        <div class="value" id="activeRequests">-</div>
                    </div>
                    <div class="stat-card">
                        <h3>Active Deliveries</h3>
                        <div class="value" id="activeDeliveries">-</div>
                    </div>
                </div>

                <div class="tabs">
                    <button class="tab active" onclick="switchTab('overview')">Overview</button>
                    <button class="tab" onclick="switchTab('verifications')">Verifications</button>
                    <button class="tab" onclick="switchTab('requests')">Requests</button>
                    <button class="tab" onclick="switchTab('deliveries')">Deliveries</button>
                    <button class="tab" onclick="switchTab('users')">Users</button>
                </div>

                <div id="overview" class="tab-content active">
                    <div class="list">
                        <h3>System Status: Running ✓</h3>
                        <p style="margin-top: 10px; color: #666;">All systems operational. Use tabs above to manage platform.</p>
                    </div>
                </div>

                <div id="verifications" class="tab-content">
                    <div class="list" id="verificationsContent">
                        <p>Loading verifications...</p>
                    </div>
                </div>

                <div id="requests" class="tab-content">
                    <div class="list" id="requestsContent">
                        <p>Loading requests...</p>
                    </div>
                </div>

                <div id="deliveries" class="tab-content">
                    <div class="list" id="deliveriesContent">
                        <p>Loading deliveries...</p>
                    </div>
                </div>

                <div id="users" class="tab-content">
                    <div class="list" id="usersContent">
                        <p>Loading users...</p>
                    </div>
                </div>
            </div>
        </div>

        <script>
            let token = localStorage.getItem('admin_token');

            function loginWithToken() {
                const input = document.getElementById('tokenInput');
                token = input.value.trim();
                if (!token) {
                    alert('Please enter a token');
                    return;
                }
                localStorage.setItem('admin_token', token);
                loadDashboard();
            }

            function logout() {
                localStorage.removeItem('admin_token');
                token = null;
                document.getElementById('dashboard').style.display = 'none';
                document.getElementById('authSection').style.display = 'block';
                document.getElementById('tokenInput').value = '';
            }

            async function loadDashboard() {
                try {
                    const response = await fetch('/api/admin/dashboard', {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    
                    if (!response.ok) {
                        alert('Authentication failed. Invalid or expired token.');
                        logout();
                        return;
                    }

                    const data = await response.json();
                    document.getElementById('totalUsers').textContent = data.total_users || 0;
                    document.getElementById('totalNGOs').textContent = data.total_ngos || 0;
                    document.getElementById('totalVolunteers').textContent = data.total_volunteers || 0;
                    document.getElementById('totalDonors').textContent = data.total_donors || 0;
                    document.getElementById('pendingNGOs').textContent = data.pending_ngo_verifications || 0;
                    document.getElementById('pendingVolunteers').textContent = data.pending_volunteer_verifications || 0;
                    document.getElementById('activeRequests').textContent = data.active_requests || 0;
                    document.getElementById('activeDeliveries').textContent = data.active_deliveries || 0;

                    document.getElementById('authSection').style.display = 'none';
                    document.getElementById('dashboard').style.display = 'block';

                    await loadVerifications();
                    await loadRequests();
                    await loadDeliveries();
                    await loadUsers();
                } catch (error) {
                    alert('Error loading dashboard: ' + error.message);
                }
            }

            async function loadVerifications() {
                try {
                    const response = await fetch('/api/admin/pending-verifications', {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    const data = await response.json();
                    
                    let html = '';
                    if (data.ngo_verifications && data.ngo_verifications.length > 0) {
                        html += '<h4>NGO Verifications</h4>';
                        data.ngo_verifications.forEach(v => {
                            html += `<div class="item"><strong>${v.organization_name}</strong> (${v.status})</div>`;
                        });
                    }
                    if (data.volunteer_verifications && data.volunteer_verifications.length > 0) {
                        html += '<h4 style="margin-top: 20px;">Volunteer Verifications</h4>';
                        data.volunteer_verifications.forEach(v => {
                            html += `<div class="item"><strong>${v.user_name || 'Unknown'}</strong> (${v.status})</div>`;
                        });
                    }
                    
                    document.getElementById('verificationsContent').innerHTML = html || '<p>No pending verifications</p>';
                } catch (error) {
                    document.getElementById('verificationsContent').innerHTML = '<p>Error loading verifications</p>';
                }
            }

            async function loadRequests() {
                try {
                    const response = await fetch('/api/admin/all-requests', {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    const requests = await response.json();
                    
                    let html = '';
                    requests.slice(0, 20).forEach(r => {
                        html += `<div class="item"><strong>${r.ngo_name}</strong> - ${r.quantity} servings (${r.status})</div>`;
                    });
                    
                    document.getElementById('requestsContent').innerHTML = html || '<p>No requests found</p>';
                } catch (error) {
                    document.getElementById('requestsContent').innerHTML = '<p>Error loading requests</p>';
                }
            }

            async function loadDeliveries() {
                try {
                    const response = await fetch('/api/admin/all-deliveries', {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    const deliveries = await response.json();
                    
                    let html = '';
                    deliveries.slice(0, 20).forEach(d => {
                        html += `<div class="item"><strong>Delivery ${d.id.substring(0, 8)}</strong> - ${d.status}</div>`;
                    });
                    
                    document.getElementById('deliveriesContent').innerHTML = html || '<p>No deliveries found</p>';
                } catch (error) {
                    document.getElementById('deliveriesContent').innerHTML = '<p>Error loading deliveries</p>';
                }
            }

            async function loadUsers() {
                try {
                    const response = await fetch('/api/admin/users', {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    const users = await response.json();
                    
                    let html = '';
                    users.slice(0, 20).forEach(u => {
                        html += `<div class="item"><strong>${u.name}</strong> (${u.role || 'no role'}) - ${u.email}</div>`;
                    });
                    
                    document.getElementById('usersContent').innerHTML = html || '<p>No users found</p>';
                } catch (error) {
                    document.getElementById('usersContent').innerHTML = '<p>Error loading users</p>';
                }
            }

            function switchTab(tabName) {
                document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                
                event.target.classList.add('active');
                document.getElementById(tabName).classList.add('active');
            }

            if (token) {
                loadDashboard();
            }
        </script>
    </body>
    </html>
    """

# ============ AUTH ENDPOINTS ============

class GoogleAuthRequest(BaseModel):
    credential: str

class PhoneVerifyRequest(BaseModel):
    phone: str
    otp: str

class RoleSelectRequest(BaseModel):
    role: str

@api_router.post("/auth/google")
async def google_auth(request: GoogleAuthRequest):
    try:
        idinfo = id_token.verify_oauth2_token(
            request.credential,
            requests.Request(),
            GOOGLE_CLIENT_ID
        )

        email = idinfo["email"]
        name = idinfo.get("name", email.split("@")[0])
        picture = idinfo.get("picture")

        is_admin = email in ADMIN_EMAILS

        user = await db.users.find_one({"email": email}, {"_id": 0})

        if user:
            if is_admin and user.get("role") != "admin":
                await db.users.update_one(
                    {"email": email},
                    {"$set": {"role": "admin", "is_verified": True, "phone_verified": True}}
                )
                user["role"] = "admin"

            token = create_jwt_token(
                user["id"],
                user["email"],
                user.get("role")
            )
            return {"token": token, "user": user}

        role = "admin" if is_admin else None

        new_user = UserBase(
            email=email,
            name=name,
            picture=picture,
            role=role,
            is_verified=is_admin,
            phone_verified=is_admin
        )

        user_dict = new_user.model_dump()
        user_dict["created_at"] = user_dict["created_at"].isoformat()
        await db.users.insert_one(user_dict.copy())

        token = create_jwt_token(new_user.id, new_user.email, role)
        return {"token": token, "user": user_dict}

    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid Google token")

@api_router.post("/auth/verify-phone")
async def verify_phone(request: PhoneVerifyRequest, user: Dict = Depends(get_current_user)):
    """Verify phone number with OTP (mock for MVP - any 6-digit OTP works)"""
    if len(request.phone) != 10 or not request.phone.isdigit():
        raise HTTPException(status_code=400, detail="Phone must be exactly 10 digits")
    
    if len(request.otp) != 6 or not request.otp.isdigit():
        raise HTTPException(status_code=400, detail="Invalid OTP format")
    
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"phone": request.phone, "phone_verified": True}}
    )
    
    return {"message": "Phone verified successfully", "phone": request.phone}

@api_router.post("/auth/select-role")
async def select_role(request: RoleSelectRequest, user: Dict = Depends(get_current_user)):
    """Select user role after authentication"""
    if request.role not in ["ngo", "donor", "volunteer"]:
        raise HTTPException(status_code=400, detail="Invalid role. Must be: ngo, donor, or volunteer")
    
    if user.get("role"):
        raise HTTPException(status_code=400, detail="Role already selected")
    
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"role": request.role}}
    )
    
    if request.role == "volunteer":
        volunteer = VolunteerVerification(user_id=user["id"])
        vol_dict = volunteer.model_dump()
        vol_dict['created_at'] = vol_dict['created_at'].isoformat()
        await db.volunteers.insert_one(vol_dict)
    
    updated_user = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    token = create_jwt_token(user["id"], user["email"], request.role)
    
    return {"message": "Role selected", "user": updated_user, "token": token}

@api_router.get("/auth/me")
async def get_me(user: Dict = Depends(get_current_user)):
    """Get current user info"""
    return user

# ============ NGO ENDPOINTS ============

class NGOVerificationCreate(BaseModel):
    organization_name: str
    registration_number: str
    address: str
    city: str
    state: str
    pincode: str
    website: Optional[str] = None
    description: Optional[str] = None
    location: Dict[str, float]
    documents: List[str] = []

@api_router.post("/ngo/verification")
async def create_ngo_verification(data: NGOVerificationCreate, user: Dict = Depends(get_current_user)):
    """Submit NGO verification request"""
    if user.get("role") != "ngo":
        raise HTTPException(status_code=403, detail="Only NGO users can submit verification")
    
    existing = await db.ngo_verifications.find_one({"user_id": user["id"]}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Verification already submitted")
    
    verification = NGOVerification(
        user_id=user["id"],
        **data.model_dump()
    )
    ver_dict = verification.model_dump()
    ver_dict['created_at'] = ver_dict['created_at'].isoformat()
    await db.ngo_verifications.insert_one(ver_dict)
    
    return {"message": "Verification submitted", "verification": ver_dict}

@api_router.get("/ngo/verification")
async def get_ngo_verification(user: Dict = Depends(get_current_user)):
    """Get NGO verification status"""
    verification = await db.ngo_verifications.find_one({"user_id": user["id"]}, {"_id": 0})
    return verification

@api_router.get("/ngo/requests")
async def get_ngo_requests(user: Dict = Depends(get_current_user)):
    """Get all food requests created by this NGO"""
    if user.get("role") != "ngo":
        raise HTTPException(status_code=403, detail="Only NGO users can access this")
    
    requests = await db.food_requests.find({"ngo_id": user["id"]}, {"_id": 0}).to_list(100)
    return requests

# ============ FOOD REQUEST ENDPOINTS ============

class FoodRequestCreate(BaseModel):
    food_type: str
    quantity: int
    urgency_level: str = "medium"
    description: Optional[str] = None
    location: Dict[str, float]
    address: str
    expires_at: Optional[str] = None

@api_router.post("/requests")
async def create_food_request(data: FoodRequestCreate, user: Dict = Depends(get_current_user)):
    """Create a new food request (NGO only, must be verified)"""
    if user.get("role") != "ngo":
        raise HTTPException(status_code=403, detail="Only NGO users can create requests")
    
    verification = await db.ngo_verifications.find_one({"user_id": user["id"]}, {"_id": 0})
    if not verification or verification.get("status") != "approved":
        raise HTTPException(status_code=403, detail="NGO must be verified to create requests")
    
    request_data = data.model_dump()
    if request_data.get('expires_at'):
        request_data['expires_at'] = datetime.fromisoformat(request_data['expires_at'].replace('Z', '+00:00'))
    
    food_request = FoodRequest(
        ngo_id=user["id"],
        ngo_name=verification.get("organization_name", "Unknown NGO"),
        **request_data
    )
    
    req_dict = food_request.model_dump()
    req_dict['created_at'] = req_dict['created_at'].isoformat()
    if req_dict.get('expires_at'):
        req_dict['expires_at'] = req_dict['expires_at'].isoformat()
    
    await db.food_requests.insert_one(req_dict)
    
    return {"message": "Request created", "request": req_dict}

@api_router.get("/requests")
async def get_food_requests(
    status: Optional[str] = None,
    food_type: Optional[str] = None,
    lat: Optional[float] = None,
    lng: Optional[float] = None,
    user: Dict = Depends(get_current_user)
):
    """Get all active food requests (for donors and volunteers)"""
    query = {}
    if status:
        query["status"] = status
    else:
        query["status"] = {"$in": ["approved", "active"]}
    
    if food_type:
        query["food_type"] = food_type
    
    requests = await db.food_requests.find(query, {"_id": 0}).to_list(100)
    
    if lat is not None and lng is not None:
        for req in requests:
            if req.get("location"):
                req["distance"] = haversine(lat, lng, req["location"]["lat"], req["location"]["lng"])
        requests.sort(key=lambda x: x.get("distance", 999999))
    
    return requests

@api_router.get("/requests/{request_id}")
async def get_food_request(request_id: str, user: Dict = Depends(get_current_user)):
    """Get a specific food request"""
    request = await db.food_requests.find_one({"id": request_id}, {"_id": 0})
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")
    return request

@api_router.post("/requests/{request_id}/confirm-receipt")
async def confirm_receipt(request_id: str, user: Dict = Depends(get_current_user)):
    """NGO confirms receipt of food"""
    if user.get("role") != "ngo":
        raise HTTPException(status_code=403, detail="Only NGO can confirm receipt")
    
    request = await db.food_requests.find_one({"id": request_id, "ngo_id": user["id"]}, {"_id": 0})
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")
    
    await db.food_requests.update_one(
        {"id": request_id},
        {"$set": {"status": "fulfilled"}}
    )
    
    await db.deliveries.update_many(
        {"request_id": request_id},
        {"$set": {"status": "confirmed", "confirmed_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    await update_analytics("meals_delivered", request.get("fulfilled_quantity", 0))
    
    return {"message": "Receipt confirmed"}

# ============ DONOR ENDPOINTS ============

class FulfillmentCreate(BaseModel):
    request_id: str
    donor_type: Optional[str] = None
    quantity: int
    food_condition: str
    availability_time: str
    food_photo: Optional[str] = None
    geo_tag: Optional[Dict[str, float]] = None
    delivery_method: str
    delivered: bool = False

@api_router.post("/donor/fulfill")
async def create_fulfillment(data: FulfillmentCreate, user: Dict = Depends(get_current_user)):
    """Donor accepts to fulfill a food request"""
    if user.get("role") != "donor":
        raise HTTPException(status_code=403, detail="Only donors can fulfill requests")
    
    request = await db.food_requests.find_one({"id": data.request_id}, {"_id": 0})
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")
    
    if request.get("status") not in ["approved", "active"]:
        raise HTTPException(status_code=400, detail="Request is not available for fulfillment")
    
    initial_status = "pending"
    if data.delivery_method == "self" and data.delivered:
        initial_status = "delivered"
    
    fulfillment = DonorFulfillment(
        request_id=data.request_id,
        donor_id=user["id"],
        donor_name=user.get("name", "Anonymous Donor"),
        donor_type=data.donor_type,
        quantity=data.quantity,
        food_condition=data.food_condition,
        availability_time=datetime.fromisoformat(data.availability_time.replace('Z', '+00:00')),
        food_photo=data.food_photo,
        geo_tag=data.geo_tag,
        delivery_method=data.delivery_method,
        delivered=data.delivered,
        status=initial_status
    )
    
    ful_dict = fulfillment.model_dump()
    ful_dict['created_at'] = ful_dict['created_at'].isoformat()
    ful_dict['availability_time'] = ful_dict['availability_time'].isoformat()
    await db.fulfillments.insert_one(ful_dict)
    
    new_fulfilled = request.get("fulfilled_quantity", 0) + data.quantity
    new_status = "active" if new_fulfilled < request.get("quantity", 0) else "fulfilled"
    
    await db.food_requests.update_one(
        {"id": data.request_id},
        {"$set": {"status": new_status, "fulfilled_quantity": new_fulfilled}}
    )
    
    if data.delivery_method == "volunteer":
        ngo_verification = await db.ngo_verifications.find_one({"user_id": request["ngo_id"]}, {"_id": 0})
        
        delivery = Delivery(
            fulfillment_id=fulfillment.id,
            request_id=data.request_id,
            donor_id=user["id"],
            ngo_id=request["ngo_id"],
            pickup_location=data.geo_tag or {"lat": 0, "lng": 0},
            pickup_address="Donor location",
            dropoff_location=request.get("location", {"lat": 0, "lng": 0}),
            dropoff_address=request.get("address", "NGO location")
        )
        del_dict = delivery.model_dump()
        del_dict['created_at'] = del_dict['created_at'].isoformat()
        await db.deliveries.insert_one(del_dict)
    
    return {"message": "Fulfillment created", "fulfillment": ful_dict}

@api_router.get("/donor/fulfillments")
async def get_donor_fulfillments(user: Dict = Depends(get_current_user)):
    """Get all fulfillments by this donor"""
    if user.get("role") != "donor":
        raise HTTPException(status_code=403, detail="Only donors can access this")
    
    fulfillments = await db.fulfillments.find({"donor_id": user["id"]}, {"_id": 0}).to_list(100)
    return fulfillments

# ============ VOLUNTEER ENDPOINTS ============

@api_router.get("/volunteer/profile")
async def get_volunteer_profile(user: Dict = Depends(get_current_user)):
    """Get volunteer profile and verification status"""
    if user.get("role") != "volunteer":
        raise HTTPException(status_code=403, detail="Only volunteers can access this")
    
    volunteer = await db.volunteers.find_one({"user_id": user["id"]}, {"_id": 0})
    return volunteer

@api_router.put("/volunteer/profile")
async def update_volunteer_profile(
    transport_mode: Optional[str] = None,
    id_document: Optional[str] = None,
    user: Dict = Depends(get_current_user)
):
    """Update volunteer profile"""
    if user.get("role") != "volunteer":
        raise HTTPException(status_code=403, detail="Only volunteers can access this")
    
    update_data = {}
    if transport_mode:
        update_data["transport_mode"] = transport_mode
    if id_document:
        update_data["id_document"] = id_document
    
    if update_data:
        await db.volunteers.update_one(
            {"user_id": user["id"]},
            {"$set": update_data}
        )
    
    volunteer = await db.volunteers.find_one({"user_id": user["id"]}, {"_id": 0})
    return volunteer

@api_router.get("/volunteer/deliveries")
async def get_volunteer_deliveries(user: Dict = Depends(get_current_user)):
    """Get deliveries assigned to this volunteer"""
    if user.get("role") != "volunteer":
        raise HTTPException(status_code=403, detail="Only volunteers can access this")
    
    volunteer = await db.volunteers.find_one({"user_id": user["id"]}, {"_id": 0})
    if not volunteer or volunteer.get("status") != "approved":
        return []
    
    deliveries = await db.deliveries.find(
        {"$or": [{"volunteer_id": user["id"]}, {"additional_volunteers": user["id"]}]},
        {"_id": 0}
    ).to_list(100)
    return deliveries

@api_router.get("/volunteer/available-deliveries")
async def get_available_deliveries(
    lat: Optional[float] = None,
    lng: Optional[float] = None,
    user: Dict = Depends(get_current_user)
):
    """Get available deliveries near volunteer"""
    if user.get("role") != "volunteer":
        raise HTTPException(status_code=403, detail="Only volunteers can access this")
    
    volunteer = await db.volunteers.find_one({"user_id": user["id"]}, {"_id": 0})
    if not volunteer or volunteer.get("status") != "approved":
        raise HTTPException(status_code=403, detail="Volunteer must be verified")
    
    deliveries = await db.deliveries.find(
        {"status": "pending", "volunteer_id": None},
        {"_id": 0}
    ).to_list(100)
    
    if lat is not None and lng is not None:
        for delivery in deliveries:
            if delivery.get("pickup_location"):
                delivery["distance"] = haversine(
                    lat, lng,
                    delivery["pickup_location"]["lat"],
                    delivery["pickup_location"]["lng"]
                )
        deliveries.sort(key=lambda x: x.get("distance", 999999))
    
    return deliveries

@api_router.post("/volunteer/deliveries/{delivery_id}/accept")
async def accept_delivery(delivery_id: str, user: Dict = Depends(get_current_user)):
    """Accept a delivery assignment"""
    if user.get("role") != "volunteer":
        raise HTTPException(status_code=403, detail="Only volunteers can accept deliveries")
    
    volunteer = await db.volunteers.find_one({"user_id": user["id"]}, {"_id": 0})
    if not volunteer or volunteer.get("status") != "approved":
        raise HTTPException(status_code=403, detail="Volunteer must be verified")
    
    delivery = await db.deliveries.find_one({"id": delivery_id}, {"_id": 0})
    if not delivery:
        raise HTTPException(status_code=404, detail="Delivery not found")
    
    if delivery.get("volunteer_id") and delivery.get("volunteer_id") != user["id"]:
        raise HTTPException(status_code=400, detail="Delivery already assigned")
    
    await db.deliveries.update_one(
        {"id": delivery_id},
        {"$set": {"volunteer_id": user["id"], "status": "assigned"}}
    )
    
    return {"message": "Delivery accepted"}

@api_router.post("/volunteer/deliveries/{delivery_id}/pickup")
async def pickup_delivery(delivery_id: str, user: Dict = Depends(get_current_user)):
    """Mark delivery as picked up"""
    delivery = await db.deliveries.find_one({"id": delivery_id, "volunteer_id": user["id"]}, {"_id": 0})
    if not delivery:
        raise HTTPException(status_code=404, detail="Delivery not found")
    
    await db.deliveries.update_one(
        {"id": delivery_id},
        {"$set": {"status": "picked_up", "picked_up_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"message": "Pickup confirmed"}

@api_router.post("/volunteer/deliveries/{delivery_id}/complete")
async def complete_delivery(
    delivery_id: str,
    delivery_proof: Optional[str] = None,
    user: Dict = Depends(get_current_user)
):
    """Complete a delivery with proof"""
    delivery = await db.deliveries.find_one({"id": delivery_id, "volunteer_id": user["id"]}, {"_id": 0})
    if not delivery:
        raise HTTPException(status_code=404, detail="Delivery not found")
    
    await db.deliveries.update_one(
        {"id": delivery_id},
        {"$set": {
            "status": "delivered",
            "delivered_at": datetime.now(timezone.utc).isoformat(),
            "delivery_proof": delivery_proof
        }}
    )
    
    await db.volunteers.update_one(
        {"user_id": user["id"]},
        {"$inc": {"delivery_count": 1}}
    )
    
    return {"message": "Delivery completed"}

# ============ ADMIN ENDPOINTS ============

async def require_admin(user: Dict = Depends(get_current_user)) -> Dict:
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user

@api_router.get("/admin/dashboard")
async def get_admin_dashboard(user: Dict = Depends(require_admin)):
    """Get admin dashboard data"""
    total_users = await db.users.count_documents({})
    total_ngos = await db.users.count_documents({"role": "ngo"})
    total_donors = await db.users.count_documents({"role": "donor"})
    total_volunteers = await db.users.count_documents({"role": "volunteer"})
    
    pending_ngo_verifications = await db.ngo_verifications.count_documents({"status": "pending"})
    pending_volunteer_verifications = await db.volunteers.count_documents({"status": "pending"})
    
    active_requests = await db.food_requests.count_documents({"status": {"$in": ["approved", "active"]}})
    active_deliveries = await db.deliveries.count_documents({"status": {"$nin": ["delivered", "confirmed"]}})
    
    return {
        "total_users": total_users,
        "total_ngos": total_ngos,
        "total_donors": total_donors,
        "total_volunteers": total_volunteers,
        "pending_ngo_verifications": pending_ngo_verifications,
        "pending_volunteer_verifications": pending_volunteer_verifications,
        "active_requests": active_requests,
        "active_deliveries": active_deliveries
    }

@api_router.get("/admin/pending-verifications")
async def get_pending_verifications(user: Dict = Depends(require_admin)):
    """Get all pending verifications"""
    ngo_verifications = await db.ngo_verifications.find({"status": "pending"}, {"_id": 0}).to_list(100)
    volunteer_verifications = await db.volunteers.find({"status": "pending"}, {"_id": 0}).to_list(100)
    
    for vol in volunteer_verifications:
        vol_user = await db.users.find_one({"id": vol["user_id"]}, {"_id": 0})
        if vol_user:
            vol["user_name"] = vol_user.get("name")
            vol["user_email"] = vol_user.get("email")
    
    return {
        "ngo_verifications": ngo_verifications,
        "volunteer_verifications": volunteer_verifications
    }

class ApprovalAction(BaseModel):
    action: str  # approve, reject
    reason: Optional[str] = None

@api_router.post("/admin/ngo/{verification_id}/review")
async def review_ngo_verification(
    verification_id: str,
    action: ApprovalAction,
    user: Dict = Depends(require_admin)
):
    """Review NGO verification (requires dual admin approval for approval)"""
    verification = await db.ngo_verifications.find_one({"id": verification_id}, {"_id": 0})
    if not verification:
        raise HTTPException(status_code=404, detail="Verification not found")
    
    approval = await db.admin_approvals.find_one({
        "target_id": verification_id,
        "target_type": "ngo",
        "final_status": "pending"
    }, {"_id": 0})
    
    if action.action == "reject":
        await db.ngo_verifications.update_one(
            {"id": verification_id},
            {"$set": {
                "status": "rejected",
                "rejection_reason": action.reason,
                "reviewed_by": user["id"],
                "reviewed_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        return {"message": "Verification rejected"}
    
    elif action.action == "approve":
        if not approval:
            new_approval = AdminApproval(
                action_type="ngo_approval",
                target_id=verification_id,
                target_type="ngo",
                admin_a_id=user["id"],
                admin_a_approved=True,
                admin_a_timestamp=datetime.now(timezone.utc)
            )
            apr_dict = new_approval.model_dump()
            apr_dict['created_at'] = apr_dict['created_at'].isoformat()
            apr_dict['admin_a_timestamp'] = apr_dict['admin_a_timestamp'].isoformat()
            await db.admin_approvals.insert_one(apr_dict)
            return {"message": "First admin approval recorded. Waiting for second admin."}
        
        elif approval.get("admin_a_id") == user["id"]:
            raise HTTPException(status_code=400, detail="Same admin cannot provide both approvals")
        
        else:
            await db.admin_approvals.update_one(
                {"id": approval["id"]},
                {"$set": {
                    "admin_b_id": user["id"],
                    "admin_b_approved": True,
                    "admin_b_timestamp": datetime.now(timezone.utc).isoformat(),
                    "final_status": "approved"
                }}
            )
            
            await db.ngo_verifications.update_one(
                {"id": verification_id},
                {"$set": {
                    "status": "approved",
                    "reviewed_by": user["id"],
                    "reviewed_at": datetime.now(timezone.utc).isoformat()
                }}
            )
            
            await db.users.update_one(
                {"id": verification["user_id"]},
                {"$set": {"is_verified": True}}
            )
            
            return {"message": "NGO verification approved"}

@api_router.post("/admin/volunteer/{user_id}/review")
async def review_volunteer_verification(
    user_id: str,
    action: ApprovalAction,
    user: Dict = Depends(require_admin)
):
    """Review volunteer verification"""
    volunteer = await db.volunteers.find_one({"user_id": user_id}, {"_id": 0})
    if not volunteer:
        raise HTTPException(status_code=404, detail="Volunteer not found")
    
    approval = await db.admin_approvals.find_one({
        "target_id": user_id,
        "target_type": "volunteer",
        "final_status": "pending"
    }, {"_id": 0})
    
    if action.action == "reject":
        await db.volunteers.update_one(
            {"user_id": user_id},
            {"$set": {
                "status": "rejected",
                "rejection_reason": action.reason,
                "reviewed_by": user["id"],
                "reviewed_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        return {"message": "Volunteer verification rejected"}
    
    elif action.action == "approve":
        if not approval:
            new_approval = AdminApproval(
                action_type="volunteer_approval",
                target_id=user_id,
                target_type="volunteer",
                admin_a_id=user["id"],
                admin_a_approved=True,
                admin_a_timestamp=datetime.now(timezone.utc)
            )
            apr_dict = new_approval.model_dump()
            apr_dict['created_at'] = apr_dict['created_at'].isoformat()
            apr_dict['admin_a_timestamp'] = apr_dict['admin_a_timestamp'].isoformat()
            await db.admin_approvals.insert_one(apr_dict)
            return {"message": "First admin approval recorded. Waiting for second admin."}
        
        elif approval.get("admin_a_id") == user["id"]:
            raise HTTPException(status_code=400, detail="Same admin cannot provide both approvals")
        
        else:
            await db.admin_approvals.update_one(
                {"id": approval["id"]},
                {"$set": {
                    "admin_b_id": user["id"],
                    "admin_b_approved": True,
                    "admin_b_timestamp": datetime.now(timezone.utc).isoformat(),
                    "final_status": "approved"
                }}
            )
            
            await db.volunteers.update_one(
                {"user_id": user_id},
                {"$set": {
                    "status": "approved",
                    "reviewed_by": user["id"],
                    "reviewed_at": datetime.now(timezone.utc).isoformat()
                }}
            )
            
            await db.users.update_one(
                {"id": user_id},
                {"$set": {"is_verified": True}}
            )
            
            return {"message": "Volunteer verification approved"}

@api_router.post("/admin/request/{request_id}/approve")
async def approve_food_request(request_id: str, user: Dict = Depends(require_admin)):
    """Approve a food request"""
    request = await db.food_requests.find_one({"id": request_id}, {"_id": 0})
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")
    
    await db.food_requests.update_one(
        {"id": request_id},
        {"$set": {
            "status": "approved",
            "approved_by": user["id"],
            "approved_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"message": "Request approved"}

@api_router.post("/admin/delivery/{delivery_id}/extra-volunteer")
async def mark_extra_volunteer_required(delivery_id: str, user: Dict = Depends(require_admin)):
    """Mark a delivery as requiring extra volunteer"""
    delivery = await db.deliveries.find_one({"id": delivery_id}, {"_id": 0})
    if not delivery:
        raise HTTPException(status_code=404, detail="Delivery not found")
    
    await db.deliveries.update_one(
        {"id": delivery_id},
        {"$set": {"extra_volunteer_required": True}}
    )
    
    return {"message": "Marked as requiring extra volunteer"}

@api_router.post("/admin/delivery/{delivery_id}/assign-volunteer")
async def assign_additional_volunteer(
    delivery_id: str,
    volunteer_id: str,
    user: Dict = Depends(require_admin)
):
    """Assign additional volunteer to a delivery"""
    delivery = await db.deliveries.find_one({"id": delivery_id}, {"_id": 0})
    if not delivery:
        raise HTTPException(status_code=404, detail="Delivery not found")
    
    volunteer = await db.volunteers.find_one({"user_id": volunteer_id}, {"_id": 0})
    if not volunteer or volunteer.get("status") != "approved":
        raise HTTPException(status_code=400, detail="Invalid or unverified volunteer")
    
    await db.deliveries.update_one(
        {"id": delivery_id},
        {"$push": {"additional_volunteers": volunteer_id}}
    )
    
    return {"message": "Volunteer assigned"}

@api_router.get("/admin/all-requests")
async def get_all_requests(user: Dict = Depends(require_admin)):
    """Get all food requests for admin"""
    requests = await db.food_requests.find({}, {"_id": 0}).to_list(500)
    return requests

@api_router.get("/admin/all-deliveries")
async def get_all_deliveries(user: Dict = Depends(require_admin)):
    """Get all deliveries for admin"""
    deliveries = await db.deliveries.find({}, {"_id": 0}).to_list(500)
    return deliveries

@api_router.get("/admin/users")
async def get_all_users(user: Dict = Depends(require_admin)):
    """Get all users"""
    users = await db.users.find({}, {"_id": 0}).to_list(500)
    return users

# ============ ANALYTICS ENDPOINTS ============

async def update_analytics(metric_type: str, value: float):
    """Helper to update analytics"""
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    
    existing = await db.analytics.find_one({
        "metric_type": metric_type,
        "period": "daily",
        "date": {"$gte": today.isoformat()}
    }, {"_id": 0})
    
    if existing:
        await db.analytics.update_one(
            {"id": existing["id"]},
            {"$inc": {"value": value}}
        )
    else:
        metric = AnalyticsMetric(
            metric_type=metric_type,
            value=value,
            period="daily",
            date=today
        )
        met_dict = metric.model_dump()
        met_dict['date'] = met_dict['date'].isoformat()
        await db.analytics.insert_one(met_dict)

@api_router.get("/analytics/public")
async def get_public_analytics():
    """Get public impact metrics"""
    total_meals = await db.analytics.aggregate([
        {"$match": {"metric_type": "meals_delivered"}},
        {"$group": {"_id": None, "total": {"$sum": "$value"}}}
    ]).to_list(1)
    
    total_ngos = await db.users.count_documents({"role": "ngo", "is_verified": True})
    total_volunteers = await db.users.count_documents({"role": "volunteer", "is_verified": True})
    total_donors = await db.users.count_documents({"role": "donor"})
    
    fulfilled_requests = await db.food_requests.count_documents({"status": "fulfilled"})
    total_requests = await db.food_requests.count_documents({})
    
    return {
        "meals_delivered": total_meals[0]["total"] if total_meals else 0,
        "ngos_served": total_ngos,
        "active_volunteers": total_volunteers,
        "donors_registered": total_donors,
        "requests_fulfilled": fulfilled_requests,
        "success_rate": (fulfilled_requests / total_requests * 100) if total_requests > 0 else 0
    }

@api_router.get("/analytics/user")
async def get_user_analytics(user: Dict = Depends(get_current_user)):
    """Get user-specific analytics"""
    if user.get("role") == "ngo":
        requests = await db.food_requests.find({"ngo_id": user["id"]}, {"_id": 0}).to_list(100)
        total_requested = sum(r.get("quantity", 0) for r in requests)
        total_received = sum(r.get("fulfilled_quantity", 0) for r in requests)
        return {
            "total_requests": len(requests),
            "total_requested_meals": total_requested,
            "total_received_meals": total_received,
            "fulfillment_rate": (total_received / total_requested * 100) if total_requested > 0 else 0
        }
    
    elif user.get("role") == "donor":
        fulfillments = await db.fulfillments.find({"donor_id": user["id"]}, {"_id": 0}).to_list(100)
        total_donated = sum(f.get("quantity", 0) for f in fulfillments)
        return {
            "total_donations": len(fulfillments),
            "total_meals_donated": total_donated
        }
    
    elif user.get("role") == "volunteer":
        volunteer = await db.volunteers.find_one({"user_id": user["id"]}, {"_id": 0})
        return {
            "total_deliveries": volunteer.get("delivery_count", 0) if volunteer else 0,
            "performance_score": volunteer.get("performance_score", 5.0) if volunteer else 5.0,
            "badges": volunteer.get("badges", []) if volunteer else []
        }
    
    return {}

# ============ AI ENDPOINTS ============

@api_router.post("/ai/urgency-score")
async def calculate_urgency_score(request_id: str, user: Dict = Depends(require_admin)):
    try:
        request = await db.food_requests.find_one({"id": request_id}, {"_id": 0})
        if not request:
            raise HTTPException(status_code=404, detail="Request not found")

        # Rule-based AI scoring
        score = 0

        urgency_weight = {
            "low": 2,
            "medium": 4,
            "high": 7,
            "critical": 9
        }
        score += urgency_weight.get(request.get("urgency_level", "medium"), 4)

        quantity = request.get("quantity", 0)
        if quantity >= 200:
            score += 3
        elif quantity >= 100:
            score += 2
        else:
            score += 1

        if request.get("food_type") == "cooked":
            score += 1

        score = min(score, 10)

        await db.food_requests.update_one(
            {"id": request_id},
            {"$set": {"ai_urgency_score": score}}
        )

        return {"urgency_score": score}
    
    except Exception as e:
        logger.error(f"AI urgency score error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/ai/match-suggestions")
async def get_match_suggestions(request_id: str, user: Dict = Depends(require_admin)):
    """Get AI suggestions for donor-NGO matching"""
    request = await db.food_requests.find_one({"id": request_id}, {"_id": 0})
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")
    
    donors = await db.users.find({"role": "donor"}, {"_id": 0}).to_list(50)
    
    return {
        "request_id": request_id,
        "suggested_donors": donors[:5],
        "matching_criteria": "proximity and food type compatibility"
    }

# ============ FILE UPLOAD ENDPOINT ============

@api_router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    user: Dict = Depends(get_current_user)
):
    """Upload a file (documents, photos)"""
    content = await file.read()
    
    file_id = str(uuid.uuid4())
    file_data = {
        "id": file_id,
        "filename": file.filename,
        "content_type": file.content_type,
        "data": base64.b64encode(content).decode('utf-8'),
        "user_id": user["id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.uploads.insert_one(file_data)
    
    return {"file_id": file_id, "filename": file.filename}

@api_router.get("/uploads/{file_id}")
async def get_file(file_id: str):
    """Get an uploaded file"""
    file_data = await db.uploads.find_one({"id": file_id}, {"_id": 0})
    if not file_data:
        raise HTTPException(status_code=404, detail="File not found")
    
    return {
        "id": file_data["id"],
        "filename": file_data["filename"],
        "content_type": file_data["content_type"],
        "data": file_data["data"]
    }

# ============ NGO MAP ENDPOINTS ============

@api_router.get("/ngos/verified")
async def get_verified_ngos():
    """Get all verified NGOs with their locations"""
    verifications = await db.ngo_verifications.find({"status": "approved"}, {"_id": 0}).to_list(500)
    
    ngos = []
    for v in verifications:
        user = await db.users.find_one({"id": v["user_id"]}, {"_id": 0})
        ngos.append({
            "id": v["user_id"],
            "organization_name": v.get("organization_name"),
            "location": v.get("location"),
            "address": v.get("address"),
            "city": v.get("city"),
            "user_name": user.get("name") if user else None
        })
    
    return ngos

# ============ SEED ADMIN ENDPOINT (DEV ONLY) ============

@api_router.post("/seed/admin")
async def seed_admin():
    """Create admin users for testing (remove in production)"""
    admins = [
        {"email": "smartplate.foodredistribution@gmail.com", "name": "Devadharshani"},
        {"email": "sdeepalakshmi13@gmail.com", "name": "Deepalakshmi"}
    ]
    
    created = []
    for admin_data in admins:
        existing = await db.users.find_one({"email": admin_data["email"]}, {"_id": 0})
        if not existing:
            admin = UserBase(
                email=admin_data["email"],
                name=admin_data["name"],
                role="admin",
                is_verified=True
            )
            admin_dict = admin.model_dump()
            admin_dict['created_at'] = admin_dict['created_at'].isoformat()
            await db.users.insert_one(admin_dict)
            created.append(admin_dict["email"])
    
    return {"message": "Admin users created", "admins": created}

@api_router.post("/make-admin/{email}")
async def make_admin(email: str):
    """Promote a user to admin (DEV ONLY - remove in production)"""
    user = await db.users.find_one({"email": email}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found. Please login with Google first.")
    
    await db.users.update_one(
        {"email": email},
        {"$set": {"role": "admin", "is_verified": True, "phone_verified": True}}
    )
    
    return {"message": f"User {email} is now an admin. Go to /admin to access the dashboard."}

# ============ SETUP ============

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
