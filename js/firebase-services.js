// js/firebase-services.js
import { db } from "./firebase-config.js";
import { 
    collection, addDoc, getDocs, query, where, doc, getDoc, updateDoc, 
    runTransaction, serverTimestamp, orderBy 
} from "https://www.gstatic.com/firebasejs/10.4.0/firebase-firestore.js";

const PATIENTS_COL = "patients";
const APPOINTMENTS_COL = "appointments";
const COUNTERS_COL = "system_counters";

/**
 * Generates a unique MRN safely using Firestore Transactions
 */
export async function generateMRN() {
    const counterRef = doc(db, COUNTERS_COL, "mrn_counter");
    
    try {
        const newMRN = await runTransaction(db, async (transaction) => {
            const counterDoc = await transaction.get(counterRef);
            let currentVal = 0;
            
            if (!counterDoc.exists()) {
                // Initialize if it doesn't exist
                transaction.set(counterRef, { lastValue: 1 });
                currentVal = 1;
            } else {
                currentVal = counterDoc.data().lastValue + 1;
                transaction.update(counterRef, { lastValue: currentVal });
            }
            
            // Format to NEO-00000X
            const formattedNumber = String(currentVal).padStart(6, '0');
            return `NEO-${formattedNumber}`;
        });
        return newMRN;
    } catch (e) {
        console.error("Error generating MRN: ", e);
        throw new Error("فشل في إنشاء الرقم الطبي الجديد.");
    }
}

/**
 * Searches for a patient by phone number
 */
export async function searchPatientByPhone(phone) {
    const q = query(collection(db, PATIENTS_COL), where("phone", "==", phone));
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
        return null;
    }
    
    // Return the first match (assuming phone numbers are unique)
    const docSnap = querySnapshot.docs[0];
    return { id: docSnap.id, ...docSnap.data() };
}

/**
 * Creates a new Patient Document
 */
export async function createPatient(patientData) {
    const mrn = await generateMRN();
    const dataToSave = {
        mrn: mrn,
        fullName: patientData.fullName,
        gender: patientData.gender,
        dob: patientData.dob,
        phone: patientData.phone,
        createdAt: serverTimestamp()
    };
    
    const docRef = await addDoc(collection(db, PATIENTS_COL), dataToSave);
    return { id: docRef.id, mrn: mrn, ...dataToSave };
}

/**
 * Creates an Appointment
 */
export async function createAppointment(appointmentData) {
    const dataToSave = {
        patientId: appointmentData.patientId,
        mrn: appointmentData.mrn,
        patientName: appointmentData.patientName, // Denormalized for fast UI
        type: appointmentData.type, // 'Now' or 'Scheduled'
        date: appointmentData.date, // YYYY-MM-DD
        time: appointmentData.time, // HH:MM
        status: appointmentData.status, // Waiting, Scheduled, etc.
        complaint: appointmentData.complaint || "",
        notes: appointmentData.notes || "",
        createdAt: serverTimestamp()
    };
    
    const docRef = await addDoc(collection(db, APPOINTMENTS_COL), dataToSave);
    return { id: docRef.id, ...dataToSave };
}

/**
 * Gets appointments for a specific date
 */
export async function getAppointmentsByDate(dateStr) {
    const q = query(
        collection(db, APPOINTMENTS_COL), 
        where("date", "==", dateStr)
    );
    const querySnapshot = await getDocs(q);
    const appointments = [];
    querySnapshot.forEach((doc) => {
        appointments.push({ id: doc.id, ...doc.data() });
    });
    return appointments; // In a real scenario, we might order by time on client or add composite index
}

/**
 * Update Appointment Status
 */
export async function updateAppointmentStatus(appointmentId, newStatus) {
    const appRef = doc(db, APPOINTMENTS_COL, appointmentId);
    await updateDoc(appRef, {
        status: newStatus,
        updatedAt: serverTimestamp()
    });
}

/**
 * Get Patient by ID (For modal viewing)
 */
export async function getPatientById(patientId) {
    const docRef = doc(db, PATIENTS_COL, patientId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() };
    }
    return null;
}

/**
 * Get Appointment history for a specific patient
 */
export async function getPatientHistory(patientId) {
    const q = query(
        collection(db, APPOINTMENTS_COL),
        where("patientId", "==", patientId)
    );
    const querySnapshot = await getDocs(q);
    const history = [];
    querySnapshot.forEach((doc) => {
        history.push({ id: doc.id, ...doc.data() });
    });
    
    // Sort descending by date locally (to avoid needing composite index during early dev)
    return history.sort((a, b) => new Date(b.date) - new Date(a.date));
}

/**
 * Search patients globally (by Name or MRN - client side filter for simplicity in phase 1)
 */
export async function globalPatientSearch(searchTerm) {
    // Firebase NoSQL doesn't support generic text search easily without Algolia.
    // For Phase 1, we fetch all (or limit) and filter locally, OR search by exact MRN/Phone.
    // Let's implement an exact MRN or Phone search, or prefix name search.
    const term = searchTerm.trim();
    let q;
    
    if (term.startsWith("NEO-")) {
        q = query(collection(db, PATIENTS_COL), where("mrn", "==", term));
    } else if (term.match(/^[0-9]+$/)) {
        q = query(collection(db, PATIENTS_COL), where("phone", "==", term));
    } else {
        // Name search (Exact match for simplicity in this phase)
        q = query(collection(db, PATIENTS_COL), where("fullName", "==", term));
    }

    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
        return { id: querySnapshot.docs[0].id, ...querySnapshot.docs[0].data() };
    }
    return null;
}
