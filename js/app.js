import * as UI from "./doctor-ui.js";
import * as DB from "./doctor-services.js";

// Global State
let currentVisitId = null;
let currentPatientId = null;
let currentMRN = null;
let currentMedications = [];
let currentFiles = [];

document.addEventListener("DOMContentLoaded", () => {
    UI.setupTabs();
    
    // Sidebar Nav
    document.querySelector('[data-target="dashboardSection"]').addEventListener('click', () => {
        UI.showSection('dashboardSection');
        loadDashboard();
    });

    document.getElementById('btnRefreshToday').addEventListener('click', loadDashboard);

    // Load Dashboard
    async function loadDashboard() {
        UI.showLoading();
        try {
            const apps = await DB.getTodayDoctorAppointments(UI.getTodayStr());
            const tbody = document.querySelector('#todayTable tbody');
            tbody.innerHTML = '';
            
            let wCount=0, cCount=0, dCount=0;

            apps.sort((a,b) => a.time.localeCompare(b.time)).forEach(app => {
                if(app.status === 'Waiting') wCount++;
                if(app.status === 'In Consultation') cCount++;
                if(app.status === 'Completed') dCount++;

                const tr = document.createElement('tr');
                let actionBtn = '';
                
                if(app.status === 'Waiting' || app.status === 'In Consultation') {
                    actionBtn = `<button class="btn-primary btn-small" onclick="window.startConsultation('${app.id}', '${app.patientId}', '${app.mrn}', '${app.complaint || ''}')">Start / Resume</button>`;
                } else if (app.status === 'Completed') {
                    actionBtn = `<span class="text-muted">Completed</span>`;
                }

                let badgeClass = app.status === 'In Consultation' ? 'Consulting' : app.status;

                tr.innerHTML = `
                    <td>${app.time}</td>
                    <td><strong>${app.mrn}</strong></td>
                    <td>${app.patientName}</td>
                    <td>${app.complaint || '-'}</td>
                    <td><span class="badge ${badgeClass}">${app.status}</span></td>
                    <td>${actionBtn}</td>
                `;
                tbody.appendChild(tr);
            });

            document.getElementById('dashWaitingCount').innerText = wCount;
            document.getElementById('dashConsultingCount').innerText = cCount;
            document.getElementById('dashCompletedCount').innerText = dCount;

        } catch (e) {
            console.error(e);
            UI.showToast("خطأ في جلب بيانات اليوم", "error");
        }
        UI.hideLoading();
    }

    // Start Consultation (Exposed to window for inline onclick)
    window.startConsultation = async (appId, patientId, mrn, receptionComplaint) => {
        UI.showLoading("تجهيز الملف الطبي...");
        try {
            // 1. Fetch Patient
            const patient = await DB.getPatientProfile(patientId);
            
            // 2. Init Visit
            const visit = await DB.initOrGetVisit(appId, patientId, mrn);
            
            // 3. Set Globals
            currentVisitId = visit.visitId;
            currentPatientId = patientId;
            currentMRN = mrn;
            currentMedications = visit.medications || [];
            currentFiles = visit.files || [];

            // 4. Populate Header
            document.getElementById('phName').innerText = patient.fullName;
            document.getElementById('phMRN').innerText = mrn;
            document.getElementById('phAge').innerText = UI.calculateAge(patient.dob);
            document.getElementById('phGender').innerText = patient.gender === 'Male' ? 'ذكر' : 'أنثى';
            document.getElementById('phDOB').innerText = patient.dob;
            document.getElementById('phPhone').innerText = patient.phone;

            // 5. Populate Form Fields (if resuming draft)
            document.getElementById('visitForm').reset();
            document.getElementById('receptionComplaintNote').querySelector('span').innerText = receptionComplaint || 'لا توجد';
            
            if (visit.chiefComplaint) document.getElementById('visitComplaint').value = visit.chiefComplaint;
            if (visit.vitals) {
                document.getElementById('vTemp').value = visit.vitals.temp || '';
                document.getElementById('vWeight').value = visit.vitals.weight || '';
                document.getElementById('vHeight').value = visit.vitals.height || '';
                document.getElementById('vSpo2').value = visit.vitals.spo2 || '';
            }
            if (visit.history) document.getElementById('hpi').value = visit.history.hpi || '';
            if (visit.examination) document.getElementById('examGeneral').value = visit.examination.general || '';
            if (visit.diagnoses) document.getElementById('diagPrimary').value = visit.diagnoses.primary || '';
            if (visit.treatmentPlan) document.getElementById('planNotes').value = visit.treatmentPlan.notes || '';

            renderMedicationsTable();
            loadPreviousVisits();

            UI.showSection('consultationSection');
        } catch (e) {
            console.error(e);
            UI.showToast("حدث خطأ في فتح الملف", "error");
        }
        UI.hideLoading();
    };

    // Medication Adder Logic
    document.getElementById('btnAddMed').addEventListener('click', () => {
        const name = document.getElementById('medName').value.trim();
        const dose = document.getElementById('medDose').value.trim();
        const duration = document.getElementById('medDuration').value.trim();
        const notes = document.getElementById('medNotes').value.trim();

        if(!name) { UI.showToast("يرجى كتابة اسم الدواء", "error"); return; }

        currentMedications.push({ name, dose, duration, notes });
        renderMedicationsTable();
        
        // Clear inputs
        document.getElementById('medName').value = '';
        document.getElementById('medDose').value = '';
        document.getElementById('medDuration').value = '';
        document.getElementById('medNotes').value = '';
    });

    window.removeMed = (index) => {
        currentMedications.splice(index, 1);
        renderMedicationsTable();
    };

    function renderMedicationsTable() {
        const tbody = document.querySelector('#medsTable tbody');
        tbody.innerHTML = '';
        currentMedications.forEach((med, i) => {
            tbody.innerHTML += `
                <tr>
                    <td><strong>${med.name}</strong></td>
                    <td>${med.dose}</td>
                    <td>${med.duration}</td>
                    <td>${med.notes}</td>
                    <td><button type="button" class="btn-secondary btn-small" onclick="window.removeMed(${i})"><i class="fa-solid fa-trash"></i></button></td>
                </tr>
            `;
        });
    }

    // Build Data Object from form
    function buildVisitDataObject() {
        return {
            chiefComplaint: document.getElementById('visitComplaint').value,
            vitals: {
                temp: document.getElementById('vTemp').value,
                weight: document.getElementById('vWeight').value,
                height: document.getElementById('vHeight').value,
                spo2: document.getElementById('vSpo2').value
            },
            history: {
                hpi: document.getElementById('hpi').value,
                gestational: document.getElementById('histGestational').value,
                delivery: document.getElementById('histDelivery').value,
                birthWeight: document.getElementById('histBirthWeight').value,
                nicu: document.getElementById('histNICU').value,
                pastFamily: document.getElementById('histPastFamily').value
            },
            examination: {
                general: document.getElementById('examGeneral').value,
                resp: document.getElementById('examResp').value,
                cvs: document.getElementById('examCVS').value,
                abd: document.getElementById('examAbd').value,
                neuro: document.getElementById('examNeuro').value
            },
            diagnoses: {
                primary: document.getElementById('diagPrimary').value,
                secondary: document.getElementById('diagSecondary').value
            },
            medications: currentMedications,
            investigations: document.getElementById('invText').value,
            treatmentPlan: {
                notes: document.getElementById('planNotes').value,
                followUpDecision: document.getElementById('planFollowupDecision').value,
                followUpDate: document.getElementById('planFollowupDate').value
            }
        };
    }

    // Save Draft
    document.getElementById('btnSaveDraft').addEventListener('click', async () => {
        UI.showLoading("جاري الحفظ...");
        try {
            const data = buildVisitDataObject();
            await DB.saveVisitData(currentVisitId, data, false);
            UI.showToast("تم الحفظ كمسودة بنجاح");
        } catch(e) { console.error(e); UI.showToast("خطأ في الحفظ", "error"); }
        UI.hideLoading();
    });

    // Complete Visit
    document.getElementById('btnCompleteVisit').addEventListener('click', async () => {
        if(!document.getElementById('diagPrimary').value) {
            UI.showToast("يجب إدخال التشخيص الأساسي (Primary Diagnosis) لإنهاء الكشف", "error");
            document.querySelector('[data-tab="tab-diagnosis"]').click();
            return;
        }

        if(confirm("تأكيد إنهاء الكشف الطبي؟ لن تتمكن من التعديل بسهولة بعد الإنهاء.")) {
            UI.showLoading("جاري إنهاء الكشف...");
            try {
                const data = buildVisitDataObject();
                await DB.saveVisitData(currentVisitId, data, true);
                UI.showToast("تم إنهاء الكشف بنجاح");
                UI.showSection('dashboardSection');
                loadDashboard();
            } catch(e) { console.error(e); UI.showToast("خطأ", "error"); }
            UI.hideLoading();
        }
    });

    // Print Rx
    document.getElementById('btnPrintRx').addEventListener('click', () => {
        document.getElementById('rxName').innerText = document.getElementById('phName').innerText;
        document.getElementById('rxAge').innerText = document.getElementById('phAge').innerText;
        document.getElementById('rxDate').innerText = UI.getTodayStr();
        
        const rxTbody = document.querySelector('#rxTable tbody');
        rxTbody.innerHTML = '';
        currentMedications.forEach(med => {
            rxTbody.innerHTML += `<tr>
                <td><strong>${med.name}</strong><br><small>${med.dose} - ${med.duration}</small><br><i>${med.notes}</i></td>
            </tr>`;
        });
        
        document.getElementById('rxNotes').innerText = document.getElementById('planNotes').value;
        
        const fDecision = document.getElementById('planFollowupDecision').value;
        const fDate = document.getElementById('planFollowupDate').value;
        document.getElementById('rxNextVisit').innerHTML = fDecision === 'Required' && fDate ? `<strong>الاستشارة / الإعادة:</strong> ${fDate}` : '';

        window.print();
    });

    // Load Previous Visits Timeline
    async function loadPreviousVisits() {
        const container = document.getElementById('previousVisitsContainer');
        container.innerHTML = '<p>جاري تحميل التاريخ المرضي...</p>';
        try {
            const visits = await DB.getPreviousVisits(currentPatientId, currentVisitId);
            if(visits.length === 0) {
                container.innerHTML = '<p class="text-muted">لا توجد زيارات سابقة مكتملة لهذا المريض.</p>';
                return;
            }
            
            container.innerHTML = '';
            visits.forEach(v => {
                const diag = v.diagnoses?.primary || 'غير مسجل';
                const dateStr = new Date(v.createdAt?.toDate() || Date.now()).toLocaleDateString('ar-EG');
                
                container.innerHTML += `
                    <div class="timeline-item">
                        <strong>${dateStr}</strong>
                        <p class="text-primary mt-10"><strong>التشخيص:</strong> ${diag}</p>
                        <p><small><strong>الشكوى:</strong> ${v.chiefComplaint || '-'}</small></p>
                        <p><small><strong>الأدوية:</strong> ${v.medications ? v.medications.map(m=>m.name).join('، ') : 'لا يوجد'}</small></p>
                    </div>
                `;
            });
        } catch(e) {
            container.innerHTML = '<p>خطأ في التحميل.</p>';
        }
    }

    // Upload File Logic
    document.getElementById('btnUploadFile').addEventListener('click', async () => {
        const fileInput = document.getElementById('fileUpload');
        const file = fileInput.files[0];
        if(!file) return;

        const statusLabel = document.getElementById('uploadStatus');
        statusLabel.classList.remove('hidden');
        statusLabel.innerText = "جاري الرفع 0%";

        try {
            const meta = await DB.uploadMedicalFile(file, currentPatientId, currentVisitId, (prog) => {
                statusLabel.innerText = `جاري الرفع ${Math.round(prog)}%`;
            });
            
            statusLabel.innerText = "تم الرفع بنجاح!";
            const li = document.createElement('li');
            li.innerHTML = `<span><i class="fa-solid fa-file-medical"></i> ${meta.fileName}</span> <a href="${meta.downloadURL}" target="_blank">عرض</a>`;
            document.getElementById('filesList').appendChild(li);
            
            // Clear input
            fileInput.value = "";
            setTimeout(()=> statusLabel.classList.add('hidden'), 3000);
            
        } catch(e) {
            console.error(e);
            statusLabel.innerText = "فشل الرفع.";
        }
    });

    // Init
    loadDashboard();
});
