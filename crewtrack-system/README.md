# crewtrack-system
# CrewTrack

CrewTrack is a web-based housekeeping shift management system designed for universities. It helps house managers, supervisors, and housekeepers coordinate tasks, track attendance, and process payroll efficiently.

---

## Roles & Features

### Housekeepers
- View assigned shifts
- Check in/out for attendance
- Monitor work status

### Supervisors
- Assign shifts to housekeepers
- Track attendance data
- Submit payroll for approval

### House Managers
- Approve weekly payroll summaries
- View reports and system activity
- Manage supervisor and staff lists

---

## Tech Stack

- **Frontend**: HTML, CSS, Bootstrap, JavaScript
- **Backend**: Node.js, Express.js
- **Database**: MySQL
- **Tools**: VS Code, GitHub, Postman

---

## Project Structure

CrewTrack/
├── index.html → Landing page
├── login.html → Login page
├── register.html → User registration
├── features.html → Features breakdown
├── housekeeper-dashboard.html → Housekeeper main panel
├── supervisor-dashboard.html → Supervisor dashboard
├── housemanager-dashboard.html → House Manager dashboard
├── myshifts.html → Housekeeper shifts view
├── attendance.html → Mark attendance
├── history.html → View shift/attendance history
├── crewtrack-backend/
│ ├── server.js → Main Express.js server
│ ├── db.js → MySQL DB connection
│ └── routes.js → Registration/Login logic
└── README.md → This file

---

## 🧾 Database Tables

| Table      | Description                                |
|------------|--------------------------------------------|
| `users`    | Stores user details & roles                |
| `shifts`   | Shift assignments and zones                |
| `tasks`    | Individual tasks under each shift          |
| `attendance` | Tracks check-ins and check-outs         |
| `payroll`  | Weekly salary calculations & approvals     |
| `approvals`| (Optional) Tracks who approved payroll     |

---

## 🔐 Verification & Security

- Supervisors and House Managers must enter an **authorization code** during registration.
  - Supervisor Code: `SV1234`
  - House Manager Code: `HM2024`
- Passwords are securely hashed using `bcrypt`.


---

## Collaboration

This repository is shared with collaborators. All contributions should follow a Git workflow:
- Pull latest changes
- Create a new branch
- Commit meaningful updates
- Push and open a pull request

---

## Contact

Maintainer: Donell Bikketi  
Email: donellbikketi@email.com  
GitHub: [@D0nell](https://github.com/D0nell)



