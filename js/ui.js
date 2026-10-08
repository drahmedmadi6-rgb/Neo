// js/ui.js

export function showSection(sectionId) {
    document.querySelectorAll('.page-section').forEach(sec => sec.classList.add('hidden'));
    document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
    
    document.getElementById(sectionId).classList.remove('hidden');
    document.querySelector(`[data-target="${sectionId}"]`)?.classList.add('active');

    // Update Page Title
    const titleMap = {
        'dashboardSection': 'لوحة التحكم',
        'newAppointmentSection': 'تسجيل حجز جديد',
        'todayAppointmentsSection': 'قائمة حجوزات اليوم',
        'upcomingAppointmentsSection': 'المواعيد المستقبلية',
        'searchPatientSection': 'البحث في السجلات الطبية'
    };
    document.getElementById('pageTitle').innerText = titleMap[sectionId];
}

export function showLoading(text = "جاري المعالجة...") {
    document.getElementById('loadingText').innerText = text;
    document.getElementById('loadingOverlay').classList.remove('hidden');
}

export function hideLoading() {
    document.getElementById('loadingOverlay').classList.add('hidden');
}

export function showToast(message, type = "success") {
    const toast = document.getElementById('toast');
    toast.innerText = message;
    toast.style.backgroundColor = type === "success" ? "var(--primary-color)" : "var(--status-cancelled)";
    toast.classList.remove('hidden');
    
    setTimeout(() => {
        toast.classList.add('hidden');
    }, 3000);
}

export function renderBadge(status) {
    let cssClass = "";
    switch(status) {
        case "Waiting": cssClass = "waiting"; break;
        case "Scheduled": cssClass = "scheduled"; break;
        case "In Consultation": cssClass = "consultation"; break;
        case "Completed": cssClass = "completed"; break;
        case "Cancelled": cssClass = "cancelled"; break;
        case "No Show": cssClass = "noshow"; break;
        default: cssClass = "scheduled";
    }
    return `<span class="badge ${cssClass}">${status}</span>`;
}

// Helper to get today's date in YYYY-MM-DD
export function getTodayStr() {
    const d = new Date();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${month}-${day}`;
}

export function getCurrentTimeStr() {
    const d = new Date();
    const hrs = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');
    return `${hrs}:${mins}`;
}
