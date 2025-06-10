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
                       <thead className="bg-gray-50"><tr><th className="th">Date</th><th className="th">Shipment #</th><th className="th">Customer</th><th className="th">Assigned Driver</th><th className="th">Status</th><th className="relative px-6 py-3"></th></tr></thead>
                       <tbody className="bg-white divide-y divide-gray-200">{filteredOrders.map(order => (<tr key={order.id}><td className="td">{order.createdAt?.seconds ? new Date(order.createdAt.seconds * 1000).toLocaleDateString() : 'N/A'}</td><td className="td font-medium">{order.shipmentNumber || 'N/A'}</td><td className="td">{order.receiverName}</td><td className="td">{order.assignedDriverName || 'Unassigned'}</td><td className="td"><StatusBadge status={order.status} /></td><td className="td text-right"><button onClick={() => setSelectedOrder(order)} className="text-blue-600 hover:text-blue-900">Manage</button></td></tr>))}</tbody>
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
    const [groupedData, setGroupedData] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [message, setMessage] = useState('');
    const [senderName, setSenderName] = useState('Your Company Name');
    
    // Hardcoded column map based on the user's SOS Inventory file
    const columnMap = {
        shipmentNumber: 'Number', // Corrected from 'Shipment #'
        receiverName: 'Customer',
        receiverContact: 'Memo',
        itemDescription: 'Description',
        itemQuantity: 'Qty',
        addr1: 'Shipping Addr 1',
        addr2: 'Shipping Addr 2',
        addr3: 'Shipping Addr 3',
        addr4: 'Shipping Addr 4',
        addr5: 'Shipping Addr 5',
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setMessage(''); setGroupedData(null);
        
        const reader = new FileReader();
        reader.onload = (event) => parseAndGroupCSV(event.target.result);
        reader.readAsText(file);
    };

    const parseAndGroupCSV = (csvText) => {
        const lines = csvText.split('\n').filter(line => line.trim() !== '');
        if (lines.length < 2) { setMessage("CSV file is empty or has no data rows."); return; }
        
        const headers = lines[0].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(h => h.trim().replace(/"/g, ''));
        const data = lines.slice(1).map(line => {
            const values = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(v => v.trim().replace(/"/g, ''));
            let row = {};
            headers.forEach((header, i) => { row[header] = values[i] || ''; });
            return row;
        });

        const shipmentKey = columnMap.shipmentNumber;
        if(!headers.includes(shipmentKey)) {
            setMessage(`Error: The required column "${shipmentKey}" was not found in your file. Please ensure your CSV has a 'Number' column.`);
            return;
        }

        const grouped = data.reduce((acc, row) => {
            const shipmentId = row[shipmentKey];
            if (!shipmentId) return acc;
            if (!acc[shipmentId]) acc[shipmentId] = [];
            acc[shipmentId].push(row);
            return acc;
        }, {});
        
        setGroupedData(grouped);
    };

    const handleImportJobs = async () => {
        if (!groupedData) { setMessage("Please upload a file to import."); return; }
        setIsProcessing(true); setMessage('');

        try {
            const batch = writeBatch(db);
            const ordersCollectionRef = collection(db, `artifacts/${appId}/public/data/orders`);

            for (const [shipmentNumber, items] of Object.entries(groupedData)) {
                const newOrderRef = doc(ordersCollectionRef);
                const firstItem = items[0];

                if (!firstItem) continue; 
                
                const addressLines = [
                    firstItem[columnMap.addr1],
                    firstItem[columnMap.addr2],
                    firstItem[columnMap.addr3],
                    firstItem[columnMap.addr4],
                    firstItem[columnMap.addr5],
                ].filter(Boolean); // Filter out empty lines
                
                const fullAddress = addressLines.join(', ');
                const city = addressLines[addressLines.length - 2] || '';
                const postalCode = addressLines[addressLines.length - 1] || '';


                const description = items.map(item => {
                    const qty = item[columnMap.itemQuantity] || '1';
                    const desc = item[columnMap.itemDescription] || item['Item'] || 'Item';
                    return `${qty}x ${desc}`;
                }).join('; ');

                const orderData = {
                    senderName: senderName || 'Default Sender',
                    shipmentNumber: shipmentNumber || '',
                    receiverName: firstItem[columnMap.receiverName] || '',
                    receiverAddress: fullAddress,
                    deliveryTown: city,
                    receiverPostal: postalCode,
                    receiverContact: firstItem[columnMap.receiverContact] || '',
                    packageDescription: description || '',
                    status: 'Booked',
                    createdAt: new Date(),
                    pickupTown: 'Warehouse',
                    packageSize: 'multiple',
                    price: 'R0.00'
                };
                
                for (const key in orderData) {
                    if (orderData[key] === undefined) orderData[key] = ''; 
                }

                batch.set(newOrderRef, orderData);
            }

            await batch.commit();
            setMessage(`Successfully imported ${Object.keys(groupedData).length} new jobs!`);
            setGroupedData(null);
        } catch (err) {
            console.error("Error importing jobs:", err);
            setMessage(`An error occurred during the import process. Firebase error: ${err.message}`);
        }
        setIsProcessing(false);
    };

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold text-gray-900">Bulk Import Shipments</h1>
            
            <div className="bg-white p-6 rounded-lg shadow space-y-4">
                <h2 className="text-xl font-bold">Step 1: Upload File & Set Sender</h2>
                 <div className="bg-blue-50 border-l-4 border-blue-400 p-4">
                    <div className="flex"><div className="flex-shrink-0"><svg className="h-5 w-5 text-blue-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg></div><div className="ml-3"><p className="text-sm text-blue-700">Export your shipments from SOS Inventory as a CSV file. The file will be automatically grouped by the **Number** column (your Shipment #).</p></div></div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="label">Client / Sender Name for this Import</label>
                        <input type="text" value={senderName} onChange={e => setSenderName(e.target.value)} className="input mt-1" />
                    </div>
                    <div>
                        <label className="label">Upload Shipments CSV File</label>
                        <input type="file" accept=".csv" onChange={handleFileChange} className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"/>
                    </div>
                </div>
            </div>

            {groupedData && (
                <div className="bg-white p-6 rounded-lg shadow">
                    <h2 className="text-xl font-bold mb-4">Step 2: Preview & Confirm</h2>
                    <p className="text-lg text-gray-700 mb-4">This file will create <span className="font-bold text-blue-600">{Object.keys(groupedData).length}</span> unique delivery jobs.</p>
                    <div className="mt-6">
                        <button onClick={handleImportJobs} disabled={isProcessing} className="w-full btn-primary disabled:bg-blue-300">
                            {isProcessing ? 'Importing...' : `Confirm & Create ${Object.keys(groupedData).length} Jobs`}
                        </button>
                    </div>
                </div>
            )}
            
            {message && <div className={`mt-4 p-4 rounded-md ${message.startsWith('Error') || message.includes('error:') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{message}</div>}
        </div>
    );
};

// --- Sub-components (Analytics, Modals, etc.) ---
const AnalyticsDashboard = ({ allOrders }) => { const stats = useMemo(() => { const today = new Date().toDateString(); const todaysOrders = allOrders.filter(o => o.createdAt && new Date(o.createdAt.seconds * 1000).toDateString() === today); const revenueToday = todaysOrders.reduce((acc, order) => acc + (parseFloat(order.price?.replace('R', '')) || 0), 0); const pendingJobs = allOrders.filter(o => o.status !== 'Completed' && o.status !== 'Cancelled').length; return { ordersToday: todaysOrders.length, revenueToday: revenueToday.toFixed(2), pendingJobs }; }, [allOrders]); return (<div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8"><AnalyticsCard title="Orders Today" value={stats.ordersToday} /><AnalyticsCard title="Revenue Today" value={`R ${stats.revenueToday}`} /><AnalyticsCard title="Pending Jobs" value={stats.pendingJobs} /></div>); };
const AnalyticsCard = ({ title, value }) => <div className="bg-white p-6 rounded-lg shadow"><h3 className="text-sm font-medium text-gray-500 truncate">{title}</h3><p className="mt-1 text-3xl font-semibold text-gray-900">{value}</p></div>;
const AddDriverModal = ({ onClose, onAddDriver }) => { const [name, setName] = useState(''); const [contact, setContact] = useState(''); const [vehicleReg, setVehicleReg] = useState(''); const handleSubmit = (e) => { e.preventDefault(); if (!name || !contact || !vehicleReg) return; onAddDriver({ name, contact, vehicleReg }); }; return (<div className="modal-backdrop"><div className="modal-content"><form onSubmit={handleSubmit}><div className="p-6"><h2 className="text-2xl font-bold mb-4">Add New Driver</h2><div className="space-y-4"><input value={name} onChange={e => setName(e.target.value)} placeholder="Full Name" className="input" required /><input value={contact} onChange={e => setContact(e.target.value)} placeholder="Contact Number" className="input" required /><input value={vehicleReg} onChange={e => setVehicleReg(e.target.value)} placeholder="Vehicle Registration" className="input" required /></div></div><div className="modal-footer"><button type="button" onClick={onClose} className="btn-secondary">Cancel</button><button type="submit" className="btn-primary">Add Driver</button></div></form></div></div>); }
const OrderDetailsModal = ({ order, onClose, onUpdateOrder }) => { const [newStatus, setNewStatus] = useState(order.status); const [assignedDriverId, setAssignedDriverId] = useState(order.assignedDriverId || ''); const [drivers, setDrivers] = useState([]); useEffect(() => { if (!db) return; const unsub = onSnapshot(collection(db, `artifacts/${appId}/public/data/drivers`), (snap) => setDrivers(snap.docs.map(d => ({ id: d.id, ...d.data() })))); return unsub; }, []); const handleSave = () => { const driver = drivers.find(d => d.id === assignedDriverId); onUpdateOrder(order.id, { status: newStatus, assignedDriverId: assignedDriverId || null, assignedDriverName: driver ? driver.name : null, }); onClose(); }; return (<div className="modal-backdrop"><div className="modal-content max-w-3xl"><div className="p-6 border-b flex justify-between items-start"><div><h2 className="text-2xl font-bold">Manage Order</h2><p className="text-sm text-gray-500">ID: {order.id}</p></div><button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button></div><div className="p-6 max-h-[60vh] overflow-y-auto grid md:grid-cols-2 gap-x-8 gap-y-6"><div className="md:col-span-2 space-y-4"><h3 className="section-title">Logistics</h3><DetailItem label="Shipment #" value={order.shipmentNumber} /><DetailItem label="Price" value={order.price} /><DetailItem label="Pickup Time" value={order.pickupTime} /><DetailItem label="Instructions" value={order.packageDescription || 'N/A'} /></div><div><h3 className="section-title">Sender</h3><DetailItem label="Name" value={order.senderName} /></div><div><h3 className="section-title">Recipient</h3><DetailItem label="Name" value={order.receiverName} /><DetailItem label="Contact" value={order.receiverContact} /><DetailItem label="Address" value={order.receiverAddress} /></div></div><div className="modal-footer flex-col sm:flex-row"><div className="grid sm:grid-cols-2 gap-4 w-full"><div><label className="label">Assign Driver</label><select value={assignedDriverId} onChange={e => setAssignedDriverId(e.target.value)} className="select"><option value="">Unassigned</option>{drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div><div><label className="label">Update Status</label><select value={newStatus} onChange={e => setNewStatus(e.target.value)} className="select">{['Booked', 'Driver Assigned', 'Collected', 'In Transit', 'Completed', 'Cancelled'].map(s => <option key={s} value={s}>{s}</option>)}</select></div></div><div className="flex gap-4 w-full sm:w-auto mt-4 sm:mt-0 self-end"><button onClick={handleSave} className="btn-primary w-full sm:w-auto">Save Changes</button></div></div></div></div>); };
const DetailItem = ({ label, value }) => <div><p className="text-sm font-medium text-gray-500">{label}</p><p className="text-base text-gray-900">{value}</p></div>;
const StatusBadge = ({ status }) => { const classes = { 'Booked': 'bg-blue-100 text-blue-800', 'Driver Assigned': 'bg-yellow-100 text-yellow-800', 'Collected': 'bg-purple-100 text-purple-800', 'In Transit': 'bg-indigo-100 text-indigo-800', 'Completed': 'bg-green-100 text-green-800', 'Cancelled': 'bg-red-100 text-red-800', }; return <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${classes[status] || 'bg-gray-100 text-gray-800'}`}>{status}</span>; };

const style = document.createElement('style');
style.textContent = `
.loading-screen { @apply flex items-center justify-center min-h-screen; }
.th { @apply px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider; }
.td { @apply px-6 py-4 whitespace-nowrap text-sm; }
.btn-primary { @apply bg-blue-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-700 transition; }
.btn-secondary { @apply bg-gray-200 text-gray-800 font-bold py-2 px-4 rounded-lg hover:bg-gray-300 transition; }
.modal-backdrop { @apply fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4; }
.modal-content { @apply bg-white rounded-lg shadow-2xl w-full; }
.modal-footer { @apply p-4 bg-gray-50 flex justify-end gap-4; }
.input { @apply w-full p-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500; }
.select { @apply mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500; }
.label { @apply block text-sm font-medium text-gray-700; }
.section-title { @apply font-bold text-lg mb-2 border-b pb-1; }
`;
document.head.appendChild(style);
