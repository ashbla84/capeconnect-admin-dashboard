import React, { useState, useEffect, useMemo } from 'react';
// Corrected: Firebase SDKs are now imported cleanly
import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, query, doc, updateDoc, addDoc, writeBatch } from 'firebase/firestore';
import { getAnalytics } from "firebase/analytics";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBIiZ6QiFrbwrWz5At-Fe3TP3O1L50fcyc",
  authDomain: "capeconnect-couriers.firebaseapp.com",
  projectId: "capeconnect-couriers",
  storageBucket: "capeconnect-couriers.appspot.com",
  messagingSenderId: "502510444401",
  appId: "1:502510444401:web:4bd0c7a32a5a6e5755a0d0",
  measurementId: "G-WKS50XJ838"
};

// Initialize Firebase services
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = 'capeconnect-couriers';
const initialAuthToken = null;

// --- SVG Icons ---
const Logo = () => (
    <div className="flex items-center space-x-3">
        <svg width="48" height="48" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="50" cy="50" r="42" stroke="#2563EB" strokeWidth="7"/><path d="M80.8 17.2 L89.4 9.6 L91.2 21.8" fill="#2563EB"/><path d="M19.2 82.8 L10.6 90.4 L8.8 78.2" fill="#2563EB"/><path d="M30 75 L40 55 L60 55 L70 75 Z" fill="#4A5568"/>
        </svg>
        <span className="text-2xl font-bold text-gray-800">CapeConnect Admin</span>
    </div>
);

// --- Main Admin App Component ---
export default function AdminApp() {
    const [isAuthReady, setIsAuthReady] = useState(false);
    const [currentView, setCurrentView] = useState('orders');
    const [error, setError] = useState('');
    
    useEffect(() => {
        if (!auth) return;
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) setIsAuthReady(true);
            else {
                try {
                    if (initialAuthToken) await signInWithCustomToken(auth, initialAuthToken);
                    else await signInAnonymously(auth);
                } catch (err) { setError("Could not authenticate admin user."); }
            }
        });
        return () => unsubscribe();
    }, []);

    if (!isAuthReady) return <div className="loading-screen"><p>Loading Admin Dashboard...</p></div>
    if (error) return <div className="loading-screen"><p className="text-red-500">{error}</p></div>
    
    return (
        <div className="bg-gray-100 min-h-screen font-sans">
            <header className="bg-white shadow-md sticky top-0 z-30">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                   <div className="flex justify-between items-center py-4"><Logo /></div>
                   <nav className="flex space-x-4 border-b">
                       <TabButton text="Deliveries" isActive={currentView === 'orders'} onClick={() => setCurrentView('orders')} />
                       <TabButton text="Bulk Import" isActive={currentView === 'import'} onClick={() => setCurrentView('import')} />
                       <TabButton text="Drivers" isActive={currentView === 'drivers'} onClick={() => setCurrentView('drivers')} />
                   </nav>
                </div>
            </header>
            <main className="py-10">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    {currentView === 'orders' && <OrdersView />}
                    {currentView === 'drivers' && <DriversView />}
                    {currentView === 'import' && <BulkImportView />}
                </div>
            </main>
        </div>
    );
}

const TabButton = ({ text, isActive, onClick }) => (
    <button onClick={onClick} className={`px-3 py-3 font-medium text-sm border-b-2 ${isActive ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>{text}</button>
);

// --- Orders View ---
const OrdersView = () => { 
    const [allOrders, setAllOrders] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [statusFilter, setStatusFilter] = useState('All');

    useEffect(() => {
        if (!db) return;
        const q = query(collection(db, `artifacts/${appId}/public/data/orders`));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setAllOrders(data.sort((a, b) => b.createdAt?.toMillis() - a.createdAt?.toMillis()));
            setIsLoading(false);
        }, err => { setError("Could not fetch orders."); setIsLoading(false); });
        return () => unsubscribe();
    }, []);
    
    const filteredOrders = useMemo(() => statusFilter === 'All' ? allOrders : allOrders.filter(o => o.status === statusFilter), [allOrders, statusFilter]);
    const handleUpdateOrder = async (orderId, updates) => {
        if (!db) return;
        const orderDocRef = doc(db, `artifacts/${appId}/public/data/orders`, orderId);
        try { await updateDoc(orderDocRef, updates); setSelectedOrder(prev => ({ ...prev, ...updates }));
        } catch (err) { console.error("Error updating order:", err); }
    };
    
    if (isLoading) return <p>Loading orders...</p>;
    if (error) return <p className="text-red-500">{error}</p>;

    return (
        <div className="space-y-8">
            <AnalyticsDashboard allOrders={allOrders} />
            <div>
                 <div className="sm:flex sm:items-center sm:justify-between mb-6">
                    <h1 className="text-3xl font-bold text-gray-900">Incoming Deliveries</h1>
                    <div className="mt-4 sm:mt-0">
                        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="select">
                            <option>All</option><option>Booked</option><option>Driver Assigned</option><option>Completed</option><option>Cancelled</option>
                        </select>
                    </div>
                </div>
                <div className="bg-white rounded-lg shadow overflow-x-auto">
                   <table className="min-w-full divide-y divide-gray-200">
                       <thead className="bg-gray-50"><tr><th className="th">Date</th><th className="th">Route</th><th className="th">Assigned Driver</th><th className="th">Status</th><th className="relative px-6 py-3"></th></tr></thead>
                       <tbody className="bg-white divide-y divide-gray-200">{filteredOrders.map(order => (<tr key={order.id}><td className="td">{new Date(order.createdAt.seconds * 1000).toLocaleDateString()}</td><td className="td font-medium">{order.pickupTown || 'N/A'} → {order.deliveryTown}</td><td className="td">{order.assignedDriverName || 'Unassigned'}</td><td className="td"><StatusBadge status={order.status} /></td><td className="td text-right"><button onClick={() => setSelectedOrder(order)} className="text-blue-600 hover:text-blue-900">Manage</button></td></tr>))}</tbody>
                   </table>
                </div>
            </div>
            {selectedOrder && <OrderDetailsModal order={selectedOrder} onClose={() => setSelectedOrder(null)} onUpdateOrder={handleUpdateOrder} />}
        </div>
    );
};

// --- Drivers View ---
const DriversView = () => { 
    const [drivers, setDrivers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [showAddModal, setShowAddModal] = useState(false);

    useEffect(() => {
        if (!db) return;
        const q = query(collection(db, `artifacts/${appId}/public/data/drivers`));
        const unsubscribe = onSnapshot(q, (snapshot) => { setDrivers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))); setIsLoading(false);
        }, err => { setError("Could not fetch drivers."); setIsLoading(false); });
        return () => unsubscribe();
    }, []);

    const handleAddDriver = async (driverData) => {
        if (!db) return;
        try { await addDoc(collection(db, `artifacts/${appId}/public/data/drivers`), { ...driverData, createdAt: new Date() }); setShowAddModal(false);
        } catch (err) { console.error("Error adding driver:", err); }
    };

    if (isLoading) return <p>Loading drivers...</p>;
    if (error) return <p className="text-red-500">{error}</p>;

    return (
        <div>
            <div className="flex justify-between items-center mb-6"><h1 className="text-3xl font-bold text-gray-900">Driver Management</h1><button onClick={() => setShowAddModal(true)} className="btn-primary">Add New Driver</button></div>
            <div className="bg-white rounded-lg shadow overflow-hidden">
                <ul className="divide-y divide-gray-200">{drivers.map(driver => (<li key={driver.id} className="p-4 flex justify-between items-center"><div><p className="font-bold text-gray-800">{driver.name}</p><p className="text-sm text-gray-600">{driver.contact}</p></div><p className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">{driver.vehicleReg}</p></li>))}</ul>
            </div>
            {showAddModal && <AddDriverModal onClose={() => setShowAddModal(false)} onAddDriver={handleAddDriver} />}
        </div>
    );
};

// --- Bulk Import View ---
const BulkImportView = () => {
    const [fileContent, setFileContent] = useState(null);
    const [parsedData, setParsedData] = useState([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [message, setMessage] = useState('');
    const [senderName, setSenderName] = useState('WCED'); // Default client

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setMessage(''); setParsedData([]);
        
        const reader = new FileReader();
        reader.onload = (event) => {
            setFileContent(event.target.result);
            parseCSV(event.target.result);
        };
        reader.readAsText(file);
    };

    const parseCSV = (csvText) => {
        const lines = csvText.split('\n').filter(line => line.trim() !== '');
        if (lines.length < 2) { setMessage("CSV file is empty or has no data rows."); return; }

        const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
        const requiredHeaders = ['Customer', 'Shipping Address', 'Shipping City', 'Shipping Zip', 'Phone', 'Notes'];
        const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));

        if (missingHeaders.length > 0) {
            setMessage(`Error: Missing required columns in CSV: ${missingHeaders.join(', ')}`);
            return;
        }

        const data = lines.slice(1).map(line => {
            const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
            let row = {};
            headers.forEach((header, i) => { row[header] = values[i]; });
            return row;
        });
        setParsedData(data);
    };

    const handleImportJobs = async () => {
        if (parsedData.length === 0) { setMessage("No data to import."); return; }
        setIsProcessing(true); setMessage('');

        try {
            const batch = writeBatch(db);
            const ordersCollectionRef = collection(db, `artifacts/${appId}/public/data/orders`);

            parsedData.forEach(row => {
                const newOrderRef = doc(ordersCollectionRef);
                const orderData = {
                    senderName: senderName, 
                    receiverName: row['Customer'] || 'N/A',
                    receiverAddress: row['Shipping Address'] || 'N/A',
                    deliveryTown: row['Shipping City'] || 'N/A',
                    receiverPostal: row['Shipping Zip'] || 'N/A',
                    receiverContact: row['Phone'] || 'N/A',
                    packageDescription: row['Notes'] || '',
                    status: 'Booked',
                    createdAt: new Date(),
                    pickupTown: 'Cape Town Warehouse', 
                    packageSize: 'medium',
                    price: 'R0.00' 
                };
                batch.set(newOrderRef, orderData);
            });

            await batch.commit();
            setMessage(`Successfully imported ${parsedData.length} new jobs!`);
            setParsedData([]); setFileContent(null);
        } catch (err) {
            console.error("Error importing jobs:", err);
            setMessage("An error occurred during the import process.");
        }
        setIsProcessing(false);
    };

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold text-gray-900">Bulk Import Shipments</h1>
            <div className="bg-white p-6 rounded-lg shadow">
                 <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-6">
                    <div className="flex"><div className="flex-shrink-0"><svg className="h-5 w-5 text-blue-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg></div><div className="ml-3"><p className="text-sm text-blue-700">Export your shipments from SOS Inventory as a CSV file. Ensure it contains the headers: <code className="font-mono bg-blue-100 p-1 rounded">Customer, Shipping Address, Shipping City, Shipping Zip, Phone, Notes</code>.</p></div></div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="md:col-span-2">
                        <label className="label">Client / Sender Name</label>
                        <input type="text" value={senderName} onCha
