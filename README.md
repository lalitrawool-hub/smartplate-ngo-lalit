# 🍽️ SmartPlate – Intelligent Food Redistribution Platform  
### *Reducing Food Waste • Fighting Hunger • Empowering Communities*
![image_alt](https://github.com/Devadharshani13/SmartPlate-Redistribution-of-foods-through-NGO/blob/main/screenshot/home%20page.png?raw=true)

---
## Demo Video link
https://www.youtube.com/watch?v=Gse5J54AMA4

## 📌 Project Overview

**SmartPlate** is a full-stack, AI-enabled food redistribution platform designed to connect **food donors**, **NGOs**, and **volunteers** in real time to reduce food waste and combat hunger.  

The platform enables surplus food from restaurants, events, hotels, corporates, and households to be efficiently redirected to NGOs and shelters using **secure authentication**, **role-based dashboards**, **geolocation**, and **AI-driven urgency scoring**.

> **Mission:** Transform surplus food into sustenance for those in need.

---

## 🎯 Problem Statement

- Millions of meals are wasted daily while people go hungry  
- NGOs struggle to source food on time  
- Donors lack a trusted, transparent redistribution channel  
- Manual coordination causes delays and inefficiency  

---

## 💡 Solution

SmartPlate solves this by providing:

- Real-time food request & fulfillment system
- Verified NGOs and volunteers
- Distance-based matching
- AI-powered urgency prioritization
- End-to-end transparency and analytics

---

## 🌍 UN Sustainable Development Goals (SDGs)

### 🟢 SDG 2 – Zero Hunger

SmartPlate directly contributes to **SDG 2** by:

- Redistributing surplus food to vulnerable populations
- Reducing food waste at the source
- Ensuring timely delivery to NGOs
- Supporting sustainable food systems

### ♻️ Also aligned with:
- **SDG 12** – Responsible Consumption & Production  
- **SDG 11** – Sustainable Cities & Communities  

---

## 🌐 Live Deployment

### 🔗 Application URLs

- **Frontend (React App)**  
  👉 https://sp-orcin-nu.vercel.app/

- **Backend API (FastAPI)**
- 👉 https://sp-2-p4ud.onrender.com

---

## 🧠 System Architecture

```

Frontend (React + Tailwind)
↓
Backend API (FastAPI)
↓
MongoDB (Motor Async)
↓
Google OAuth + JWT Authentication
↓
AI Services (Urgency Scoring)

```

---

## 🔐 Authentication & Security

- Google OAuth 2.0 login
- JWT-based session handling
- Role-Based Access Control (RBAC)
- Protected admin routes
- Secure API access with HTTPBearer
- Environment-based secrets management

---

## 👥 User Roles & Features

### 🏢 NGO
- Register & verify organization
- Create food requests
- Set urgency & expiry
- Track fulfillment status
- Confirm food receipt

### 🍱 Donor
- View nearby food requests
- Filter by urgency & food type
- Submit food donations
- Upload geo-tagged food images
- Track donation impact

### 🚚 Volunteer
- Apply for verification
- Accept delivery tasks
- Pickup & drop food
- Track delivery history & performance

### 🛡️ Admin (Dual-Admin Governance)
- Approve NGOs & volunteers
- Approve food requests
- Trigger AI urgency scoring
- Monitor deliveries & users
- Platform analytics dashboard

---

## 🤖 AI Integration

### AI Urgency Scoring
- Admin-triggered AI evaluation of food requests
- Considers:
  - Quantity
  - Urgency level
  - Description
  - Expiry time
- Outputs score (0–10)
- Helps prioritize critical requests

### Future AI Extensions
- Donor-NGO smart matching
- Demand prediction
- Food expiry risk detection

---

## 📊 Analytics & Impact Tracking

SmartPlate tracks real-time metrics:

- 🍲 Meals delivered
- 🏢 NGOs served
- 🙋 Active donors & volunteers
- 📦 Fulfillment success rate
- ⏱️ Response time
- 📈 Platform growth

---

## 🧰 Tech Stack

### Frontend
- React.js
- Tailwind CSS
- shadcn/ui
- Axios
- Google OAuth (`@react-oauth/google`)
- Lucide Icons

### Backend
- FastAPI (Python)
- JWT Authentication (`pyjwt`)
- Google OAuth token verification
- RESTful API design

### Database
- MongoDB
- Async access using Motor
- Document-based schema

### AI & Utilities
- LLM-based urgency scoring
- Distance calculation (Haversine)
- File uploads (Base64)

### Deployment
- Frontend: Vercel
- Backend: Render
- Environment-based configuration

---

## 📈 Economic & Social Impact

### Economic Value

* Reduces food waste losses
* Saves NGO food procurement costs
* Enables CSR participation
* Scalable B2B & NGO partnerships

### Social Impact

* Feeds underserved communities
* Builds volunteer engagement
* Encourages responsible consumption
* Promotes digital social good

---

## 🌱 Vision Statement

> **SmartPlate envisions a world where no edible food is wasted and no one goes hungry.**
> By combining technology, AI, and community collaboration, we transform surplus into sustenance.

---

## 👩‍💻 Team

**Project Developer:**

**Devadharshani**

**Deepalakshmi S**

**Ambigai**

📧 [smartplate.foodredistribution@gmail.com](mailto:smartplate.foodredistribution@gmail.com)

---

## 📜 License

This project is developed for educational, social impact, and hackathon purposes.

---
### ⭐ “From surplus to sustenance — one plate at a time.”
