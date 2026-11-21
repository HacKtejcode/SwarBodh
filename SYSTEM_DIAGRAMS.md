# Swar Bodh: System Architecture & Design Diagrams

This document contains the Data Flow Diagrams (DFD) and Unified Modeling Language (UML) diagrams for the Swar Bodh project. These diagrams are written in **Mermaid.js** syntax and can be rendered in VS Code, GitHub, or any Mermaid-compatible viewer.

---

## 1. Data Flow Diagrams (DFD)

### Level 0: Context Diagram
The context diagram shows the system as a single process and its interaction with external entities.

```mermaid
graph LR
    User((User))
    IoT((IoT Hardware))
    System[[Swar Bodh System]]
    
    User -- "Voice Audio / Commands" --> System
    IoT -- "Raw PCM Audio Stream" --> System
    System -- "Vocal Analysis & Reports" --> User
    System -- "Visual Feedback" --> User
```

### Level 1: Main Processes
Breakdown of data flow between the Mobile App, Backend API, and Database.

```mermaid
graph LR
    U[User]
    H[IoT Hardware]
    
    subgraph "Swar Bodh Core Processing"
        direction LR
        P1(Vocal Capture & Pre-processing)
        P2(Vocalytics & Guru Analysis)
        P3(Scale & Sargam Detection)
    end
    
    subgraph "Storage & Feedback"
        direction LR
        P4(History & Vault Management)
        DB[(SQLite Database)]
    end
    
    U -- "Audio / Login" --> P1
    H -- "WebSocket Stream" --> P1
    P1 -- "Cleaned Audio" --> P2
    P1 -- "Acoustic Data" --> P3
    P2 -- "Strain Metrics" --> P4
    P3 -- "Note/Scale Data" --> P4
    P4 -- "Read/Write" --- DB
    P4 -- "Analysis Result" --> U
```

---

## 2. UML Use Case Diagram
Defines the interactions between the users and the system's major features.

```mermaid
useCaseDiagram
    actor "Singer / Student" as User
    actor "ESP32 Hardware" as IoT
    
    package "Swar Bodh Application" {
        usecase "Authenticate (Login/OTP)" as UC1
        usecase "Real-time Strain Analysis" as UC2
        usecase "Vocal Guru (Full Song)" as UC3
        usecase "Sargam Practice" as UC4
        usecase "Tanpura Practice" as UC5
        usecase "Manage Recording Vault" as UC6
        usecase "Automatic Scale Detection" as UC7
    }
    
    User --> UC1
    User --> UC2
    User --> UC3
    User --> UC4
    User --> UC5
    User --> UC6
    User --> UC7
    
    IoT --> UC2
    IoT --> UC7
```

---

## 3. UML Sequence Diagram: Voice Analysis Flow
The typical interaction flow when a user performs a Vocalytics analysis.

```mermaid
sequenceDiagram
    participant U as User
    participant App as Mobile App
    participant WS as WebSocket Bridge
    participant API as Backend API
    participant AN as Analyzer (Parselmouth/Librosa)
    participant DB as Database

    U->>App: Start Recording
    App->>App: Record Audio Chunk
    alt Phone Mode
        App->>API: POST /analyze
    else IoT Mode
        App->>WS: START_IOT_SCALE
        IoT-->>WS: Stream PCM Bytes
        WS->>API: Push Audio
    end
    
    API->>AN: Process Audio (FFT, Jitter, Shimmer)
    AN-->>API: Return Metrics
    API->>DB: Save Record
    API-->>App: Return JSON Result
    App->>U: Display Vocalytics Report
```

---

## 4. UML Architecture Diagram
A high-level view of the technology stack and system components.

```mermaid
graph BT
    subgraph "Client Tier (Mobile App)"
        UI[React Native / Expo]
        Anim[Reanimated Engine]
        AV[Expo-AV]
    end
    
    subgraph "Bridge Tier"
        WS[WebSocket Bridge]
    end
    
    subgraph "Server Tier (Backend)"
        FastAPI[FastAPI API]
        Proc[Audio Processing Engine]
        Praat[Parselmouth / Praat]
        Lib[Librosa / NumPy]
    end
    
    subgraph "Data Tier"
        DB[(SQLite / SQLAlchemy)]
    end
    
    UI -- "REST / JWT" --> FastAPI
    UI -- "Bi-directional" --> WS
    WS -- "Audio Push" --> FastAPI
    FastAPI -- "Analysis Task" --> Proc
    Proc --> Praat
    Proc --> Lib
    FastAPI -- "Query/Save" --> DB
```

---

## 5. Entity Relationship (ER) Diagram
The database schema structure.

```mermaid
erDiagram
    USER ||--o{ RECORD : performs
    USER {
        int id PK
        string username
        string password_hash
        string email
    }
    RECORD {
        int id PK
        int user_id FK
        string avg_db
        string peak_db
        string instability
        string pitch_hz
        string note
        boolean is_strained
        string indicators
        string recommendation
        string timestamp
    }
```

---

## 6. System Flowchart (Logical Execution Path)
This flowchart describes the end-to-step-by-step logic of a vocal session, from initialization to feedback.

```mermaid
graph LR
    Start([Start Session]) --> Login{Authenticated?}
    
    Login -- No --> Auth[Auth Screen: OTP/Login]
    Auth --> Login
    
    Login -- Yes --> Dashboard[Vocalytics Dashboard]
    
    Dashboard --> ModeSelect{Select Source}
    
    subgraph "Data Acquisition"
        direction TB
        ModeSelect -- Phone Mic --> Rec[Internal Recording]
        ModeSelect -- IoT Hardware --> IoT[WebSocket Stream]
    end
    
    Rec --> Backend
    IoT --> Backend
    
    subgraph "Intelligence Engine"
        direction LR
        Backend[Backend Processing] --> Analysis{Vocal Analysis}
        Analysis --> Pitch[Pitch/Note]
        Analysis --> Strain[Jitter/Shimmer]
        Analysis --> Scale[Raga/Scale]
    end
    
    Pitch --> ResultGen
    Strain --> ResultGen
    Scale --> ResultGen
    
    subgraph "Finalization"
        direction LR
        ResultGen[Generate Guru Report] --> DB[(Save to DB)]
        DB --> Vault[Audio Vault]
        Vault --> Display[Display Results]
    end
    
    Display --> End([Session End])
```

---

## 🎨 Diagram Legend & Notes
- **DFD**: Focuses on the movement of data between internal and external sources.
- **UML Use Case**: Highlights "What" the system does for the user.
- **Sequence Diagram**: Highlights "How" components talk to each other in time.
- **ER Diagram**: Visualizes the data storage structure.

*Generated by Antigravity AI for the Swar Bodh Project Team.*
