// js/app.js
import * as UI from "./ui.js";
import * as DB from "./firebase-services.js";

// Global Variables
let currentFormPatient = null; // Holds existing patient data if found

document.addEventListener("DOMContentLoaded", () => {
    
    // 1. Navigation Setup
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const target = e.currentTarget.getAttribute('data-target');
            UI.showSection(target);
            
            // Trigger data load based on section
            if (target === 'dashboardSection') loadDashboard();
            if (target === 'todayAppointmentsSection') loadTodayAppointments();
            if (target === 'upcomingAppointmentsSection') {
                document.getElementById('filterUpcomingDate').value = UI.getTodayStr();
                loadUpcomingAppointments();
            }
        });
    });

    // 2. New Appointment Logic (Check Phone)
    document.getElementById('btnCheckPhone').addEventListener('click', async () => {
        const phone = document.getElementById('checkPhoneInput').value.trim();
        if (!phone) {
            UI.showToast("الرجاء إدخال رقم الهاتف", "error"); return;
        }

        UI.showLoading("جاري البحث...");
        try {
            const patient = await DB.searchPatientByPhone(phone);
            const resultDiv = document.getElementById('patientSearchResult');
            const formContainer = document.getElementById('appointmentFormContainer');
            
            resultDiv.classList.remove('hidden');
            formContainer.classList.remove('hidden');

            if (patient) {
                // EXISTING PATIENT
                currentFormPatient = patient;
                resultDiv.className = "alert info mt-10";
                resultDiv.innerHTML = `<i class="fa-solid fa-circle-info"></i> <strong>المريض موجود بالفعل:</strong> ملف رقم ${patient.mrn} - المتابعة لإنشاء حجز جديد.`;
                
                document.getElementById('formTitle').innerText = "تأكيد بيانات المريض وحجز الموعد";
                document.getElementById('formFullName').value = patient.fullName;
                document.getElementById('formFullName').readOnly = true;
                document.getElementById('formPhone').value = patient.phone;
                document.getElementById('formGender').value = patient.gender;
                document.getElementById('formGender').disabled = true;
                document.getElementById('formDOB').value = patient.dob;
                document.getElementById('formDOB').readOnly = true;
            } else {
                // NEW PATIENT
                currentFormPatient = null;
                resultDiv.className = "alert success mt-10";
                resultDiv.innerHTML = `<i class="fa-solid fa-user-plus"></i> <strong>مريض جديد:</strong> يرجى تعبئة البيانات الأساسية לإنشاء ملف طبي وحجز الموعد.`;
                
                document.getElementById('formTitle').innerText = "تسجيل بيانات المريض الجديد";
                document.getElementById('newAppointmentForm').reset();
                
                // Keep the phone number typed
                document.getElementById('formPhone').value = phone;
                
                // Make fields editable
                document.getElementById('formFullName').readOnly = false;
                document.getElementById('formGender').disabled = false;
                document.getElementById('formDOB').readOnly = false;
            }
        } catch (error) {
            UI.showToast("حدث خطأ أثناء البحث", "error");
            console.error(error);
        }
        UI.hideLoading();
    });

    // 3. Appointment Type Toggle (Now vs Scheduled)
    const radios = document.getElementsByName('appType');
    radios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            const isScheduled = e.target.value === 'Scheduled';
            document.getElementById('futureDateTimeGroup').classList.toggle('hidden', !isScheduled);
            document.getElementById('futureTimeGroup').classList.toggle('hidden', !isScheduled);
            
            if(isScheduled) {
                document.getElementById('formAppDate').required = true;
                document.getElementById('formAppTime').required = true;
            } else {
                document.getElementById('formAppDate').required = false;
                document.getElementById('formAppTime').required = false;
            }
        });
    });

    // 4. Submit New Appointment
    document.getElementById('newAppointmentForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        UI.showLoading("جاري حفظ الحجز...");

        try {
            let patientId, mrn;
            const phone = document.getElementById('formPhone').value;
            const fullName = document.getElementById('formFullName').value;
            const gender = document.getElementById('formGender').value;
            const dob = document.getElementById('formDOB').value;
            
            // Create patient if new
            if (!currentFormPatient) {
                const newPatient = await DB.createPatient({
                    fullName, gender, dob, phone
                });
                patientId = newPatient.id;
                mrn = newPatient.mrn;
            } else {
                patientId = currentFormPatient.id;
                mrn = currentFormPatient.mrn;
            }

            // Prep Appointment Data
            const appType = document.querySelector('input[name="appType"]:checked').value;
            const complaint = document.getElementById('formComplaint').value;
            const notes = document.getElementById('formNotes').value;
            
            let appDate, appTime, status;

            if (appType === 'Now') {
                appDate = UI.getTodayStr();
                appTime = UI.getCurrentTimeStr();
                status = "Waiting";
            } else {
                appDate = document.getElementById('formAppDate').value;
                appTime = document.getElementById('formAppTime').value;
                status = "Scheduled";
            }

            const appointmentData = {
                patientId, mrn, patientName: fullName,
                type: appType, date: appDate, time: appTime,
                status, complaint, notes
            };

            await DB.createAppointment(appointmentData);

            UI.showToast(`تم تأكيد الحجز بنجاح! رقم الملف: ${mrn}`);
            
            // Reset and return to dashboard
            document.getElementById('newAppointmentForm').reset();
            document.getElementById('appointmentFormContainer').classList.add('hidden');
            document.getElementById('patientSearchResult').classList.add('hidden');
            document.getElementById('checkPhoneInput').value = "";
            document.querySelector('[data-target="dashboardSection"]').click();

        } catch (error) {
            UI.showToast("حدث خطأ أثناء الحفظ. تأكد من إعدادات قاعدة البيانات.", "error");
            console.error(error);
        }
        UI.hideLoading();
    });

    // 5. Load Today's Appointments
    async function loadTodayAppointments() {
        UI.showLoading("جاري تحميل مواعيد اليوم...");
        const todayStr = UI.getTodayStr();
        const tbody = document.querySelector('#todayTable tbody');
        tbody.innerHTML = '';

        try {
            const apps = await DB.getAppointmentsByDate(todayStr);
            
            if(apps.length === 0) {
                tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--text-muted);">لا توجد حجوزات لهذا اليوم.</td></tr>`;
            } else {
                // Sort by time
                apps.sort((a,b) => a.time.localeCompare(b.time));
                
                apps.forEach(app => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td><strong>${app.time}</strong></td>
                        <td>${app.mrn}</td>
                        <td>${app.patientName}</td>
                        <td>${UI.renderBadge(app.status)}</td>
                        <td>
                            <button class="btn-secondary btn-small" onclick="window.viewPatient('${app.patientId}')">ملف المريض</button>
                            <button class="btn-primary btn-small" onclick="window.openStatusModal('${app.id}', '${app.status}')">تعديل الحالة</button>
                        </td>
                    `;
                    tbody.appendChild(tr);
                });
            }
        } catch(e) {
            console.error(e);
            UI.showToast("فشل تحميل المواعيد", "error");
        }
        UI.hideLoading();
    }

    document.getElementById('btnRefreshToday').addEventListener('click', loadTodayAppointments);

    // 6. Dashboard Stats Logic
    async function loadDashboard() {
        try {
            const apps = await DB.getAppointmentsByDate(UI.getTodayStr());
            const waitingCount = apps.filter(a => a.status === 'Waiting').length;
            
            document.getElementById('dashTodayCount').innerText = apps.length;
            document.getElementById('dashWaitingCount').innerText = waitingCount;
            // Upcoming count logic requires range query, simplified for now
            document.getElementById('dashUpcomingCount').innerText = "--"; 
        } catch(e) {}
    }

    // 7. Global Patient Search
    document.getElementById('btnGlobalSearch').addEventListener('click', async () => {
        const term = document.getElementById('globalSearchInput').value;
        if(!term) return;
        
        UI.showLoading("جاري البحث...");
        try {
            const patient = await DB.globalPatientSearch(term);
            if(patient) {
                window.viewPatient(patient.id); // Open profile modal
            } else {
                UI.showToast("لم يتم العثور على المريض", "error");
            }
        } catch(e) {
            console.error(e);
            UI.showToast("خطأ في البحث", "error");
        }
        UI.hideLoading();
    });

    // Modals Handling (Exposing to window for inline onclicks)
    window.openStatusModal = function(appId, currentStatus) {
        document.getElementById('statusAppId').value = appId;
        document.getElementById('newStatusSelect').value = currentStatus;
        document.getElementById('statusModal').classList.remove('hidden');
    }

    document.getElementById('statusForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const appId = document.getElementById('statusAppId').value;
        const newStatus = document.getElementById('newStatusSelect').value;
        
        UI.showLoading();
        try {
            await DB.updateAppointmentStatus(appId, newStatus);
            UI.showToast("تم تحديث الحالة");
            document.getElementById('statusModal').classList.add('hidden');
            // Refresh table
            loadTodayAppointments();
        } catch(e) { console.error(e); }
        UI.hideLoading();
    });

    window.viewPatient = async function(patientId) {
        UI.showLoading();
        try {
            const patient = await DB.getPatientById(patientId);
            const history = await DB.getPatientHistory(patientId);
            
            const infoDiv = document.getElementById('modalPatientInfo');
            infoDiv.innerHTML = `
                <div class="profile-item"><span>الاسم الكامل</span><strong>${patient.fullName}</strong></div>
                <div class="profile-item"><span>الرقم الطبي (MRN)</span><strong>${patient.mrn}</strong></div>
                <div class="profile-item"><span>رقم الهاتف</span><strong>${patient.phone}</strong></div>
                <div class="profile-item"><span>النوع</span><strong>${patient.gender === 'Male' ? 'ذكر' : 'أنثى'}</strong></div>
                <div class="profile-item"><span>تاريخ الميلاد</span><strong>${patient.dob}</strong></div>
            `;

            const tbody = document.querySelector('#historyTable tbody');
            tbody.innerHTML = '';
            if(history.length === 0) {
                tbody.innerHTML = `<tr><td colspan="3" style="text-align:center;">لا توجد زيارات سابقة.</td></tr>`;
            } else {
                history.forEach(app => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td>${app.date} <br> <small>${app.time}</small></td>
                        <td>${app.complaint || '-'}</td>
                        <td>${UI.renderBadge(app.status)}</td>
                    `;
                    tbody.appendChild(tr);
                });
            }

            document.getElementById('patientModal').classList.remove('hidden');
        } catch(e) {
            console.error(e);
            UI.showToast("خطأ في جلب بيانات المريض", "error");
        }
        UI.hideLoading();
    }

    // Close Modals
    document.getElementById('closePatientModal').addEventListener('click', () => {
        document.getElementById('patientModal').classList.add('hidden');
    });
    document.getElementById('closeStatusModal').addEventListener('click', () => {
        document.getElementById('statusModal').classList.add('hidden');
    });

    // Initial Load
    loadDashboard();
});
