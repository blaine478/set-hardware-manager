import { db } from './firebase-config.js';
import { collection, addDoc, updateDoc, doc, onSnapshot } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';

const { useState, useEffect, useCallback } = React;
const { jsPDF } = window.jspdf;

function ErrorBoundary({ children }) {
  const [error, setError] = useState(null);
  if (error) {
    return (
      <div className="p-4 bg-red-100 text-red-700 rounded-lg text-center">
        <p>An error occurred: {error.message}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
        >
          Reload App
        </button>
      </div>
    );
  }
  return children;
}

function App() {
  const [orders, setOrders] = useState([]);
  const [newOrder, setNewOrder] = useState({ setNumber: '', items: [{ name: '', for: '', deliveryDate: '' }], pickupPerson: '', pickupTime: '' });
  const [showArchived, setShowArchived] = useState(false);
  const [expandedOrder, setExpandedOrder] = useState(null);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [setNumbers, setSetNumbers] = useState([]);
  const [recipients, setRecipients] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const auth = getAuth();
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        setLoading(false);
      } else {
        setError('Authentication required. Please try again.');
      }
    });
    return () => unsubscribeAuth();
  }, []);

  const fetchOrders = useCallback(() => {
    const unsubscribe = onSnapshot(collection(db, 'orders'), (snapshot) => {
      try {
        const ordersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setOrders(ordersData);
        const uniqueSetNumbers = [...new Set(ordersData.map(order => order.setNumber))];
        const uniqueRecipients = [...new Set(ordersData.flatMap(order => order.items.map(item => item.for)))];
        setSetNumbers(uniqueSetNumbers);
        setRecipients(uniqueRecipients);
        setError(null);
      } catch (err) {
        setError('Failed to fetch orders. Please try again.');
        console.error(err);
      }
    }, (err) => {
      setError('Failed to listen for orders. Please try again.');
      console.error(err);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (user) {
      const unsubscribe = fetchOrders();
      return () => unsubscribe();
    }
  }, [user, fetchOrders]);

  const addOrder = async () => {
    if (!newOrder.setNumber || !newOrder.items.every(item => item.name && item.for && item.deliveryDate)) {
      setError('Please fill in all item details.');
      return;
    }
    try {
      await addDoc(collection(db, 'orders'), { ...newOrder, archived: false, createdAt: new Date().toISOString() });
      setNewOrder({ setNumber: '', items: [{ name: '', for: '', deliveryDate: '' }], pickupPerson: '', pickupTime: '' });
      setError(null);
    } catch (err) {
      setError('Failed to add order. Please try again.');
      console.error(err);
    }
  };

  const markPickedUp = async (orderId, pickupPerson) => {
    if (!pickupPerson) {
      setError('Please enter a pickup person.');
      return;
    }
    try {
      const orderRef = doc(db, 'orders', orderId);
      await updateDoc(orderRef, { pickupPerson, pickupTime: new Date().toISOString() });
      setError(null);
      console.log(`Notification: Order ${orderId} picked up by ${pickupPerson}`);
    } catch (err) {
      setError('Failed to mark as picked up. Please try again.');
      console.error(err);
    }
  };

  const toggleArchive = async (orderId, archived) => {
    try {
      const orderRef = doc(db, 'orders', orderId);
      await updateDoc(orderRef, { archived });
      setError(null);
    } catch (err) {
      setError('Failed to update archive status. Please try again.');
      console.error(err);
    }
  };

  const generatePDF = (order) => {
    try {
      const doc = new jsPDF();
      doc.setFont("helvetica", "bold");
      doc.text("Set Hardware Order", 105, 20, { align: "center" });
      doc.setFont("helvetica", "normal");
      doc.text(`Set Number: ${order.setNumber}`, 20, 40);
      doc.text(`Created: ${new Date(order.createdAt).toLocaleDateString()}`, 20, 50);
      doc.text("Items:", 20, 60);
      order.items.forEach((item, index) => {
        doc.text(`${index + 1}. ${item.name} for ${item.for} (Expected: ${item.deliveryDate})`, 30, 70 + index * 10);
      });
      if (order.pickupPerson) {
        doc.text(`Picked Up By: ${order.pickupPerson}`, 20, 80 + order.items.length * 10);
        doc.text(`Pickup Time: ${new Date(order.pickupTime).toLocaleString()}`, 20, 90 + order.items.length * 10);
      }
      doc.save(`order_${order.setNumber}_${new Date().toISOString().split('T')[0]}.pdf`);
      setError(null);
    } catch (err) {
      setError('Failed to generate PDF. Please try again.');
      console.error(err);
    }
  };

  const generateBatchPDF = () => {
    try {
      const doc = new jsPDF();
      let yOffset = 20;
      const filteredOrders = orders.filter(order => 
        (showArchived ? order.archived : !order.archived) &&
        (order.setNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
         order.items.some(item => item.name.toLowerCase().includes(searchTerm.toLowerCase())))
      );
      
      filteredOrders.forEach((order, index) => {
        if (index > 0) doc.addPage();
        doc.setFont("helvetica", "bold");
        doc.text(`Set Hardware Order - Set ${order.setNumber}`, 105, yOffset, { align: "center" });
        doc.setFont("helvetica", "normal");
        doc.text(`Created: ${new Date(order.createdAt).toLocaleDateString()}`, 20, yOffset + 10);
        doc.text("Items:", 20, yOffset + 20);
        order.items.forEach((item, itemIndex) => {
          doc.text(`${itemIndex + 1}. ${item.name} for ${item.for} (Expected: ${item.deliveryDate})`, 30, yOffset + 30 + itemIndex * 10);
        });
        if (order.pickupPerson) {
          doc.text(`Picked Up By: ${order.pickupPerson}`, 20, yOffset + 40 + order.items.length * 10);
          doc.text(`Pickup Time: ${new Date(order.pickupTime).toLocaleString()}`, 20, yOffset + 50 + order.items.length * 10);
        }
        yOffset = 20;
      });
      doc.save(`batch_orders_${new Date().toISOString().split('T')[0]}.pdf`);
      setError(null);
    } catch (err) {
      setError('Failed to generate batch PDF. Please try again.');
      console.error(err);
    }
  };

  const addItemToOrder = () => {
    setNewOrder({ ...newOrder, items: [...newOrder.items, { name: '', for: '', deliveryDate: '' }] });
  };

  const updateItem = (index, field, value) => {
    const updatedItems = [...newOrder.items];
    updatedItems[index][field] = value;
    setNewOrder({ ...newOrder, items: updatedItems });
  };

  const removeItem = (index) => {
    if (newOrder.items.length > 1) {
      const updatedItems = newOrder.items.filter((_, i) => i !== index);
      setNewOrder({ ...newOrder, items: updatedItems });
    }
  };

  const filteredOrders = orders.filter(order => 
    (showArchived ? order.archived : !order.archived) &&
    (order.setNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
     order.items.some(item => item.name.toLowerCase().includes(searchTerm.toLowerCase())))
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-gray-600 text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-100 flex flex-col items-center p-4 font-sans">
        <div className="w-full max-w-4xl bg-white rounded-2xl shadow-xl p-6">
          <h1 className="text-3xl font-bold text-gray-800 mb-6 text-center">Set Hardware Tracker</h1>
          {error && (
            <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg flex justify-between items-center">
              <span>{error}</span>
              <button onClick={() => setError(null)} className="text-red-700 font-bold">✕</button>
            </div>
          )}

          <div className="mb-6">
            <h2 className="text-xl font-semibold text-gray-700 mb-2">New Order</h2>
            <div className="relative mb-2">
              <input
                type="text"
                placeholder="Set Number"
                value={newOrder.setNumber}
                onChange={(e) => setNewOrder({ ...newOrder, setNumber: e.target.value })}
                list="setNumbers"
                className="w-full p-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <datalist id="setNumbers">
                {setNumbers.map((setNum, index) => (
                  <option key={index} value={setNum} />
                ))}
              </datalist>
            </div>
            {newOrder.items.map((item, index) => (
              <div key={index} className="flex gap-2 mb-2 items-center">
                <input
                  type="text"
                  placeholder="Item Name"
                  value={item.name}
                  onChange={(e) => updateItem(index, 'name', e.target.value)}
                  className="flex-1 p-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <div className="relative flex-1">
                  <input
                    type="text"
                    placeholder="For (Person/Role)"
                    value={item.for}
                    onChange={(e) => updateItem(index, 'for', e.target.value)}
                    list={`recipients-${index}`}
                    className="w-full p-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <datalist id={`recipients-${index}`}>
                    {recipients.map((recipient, i) => (
                      <option key={i} value={recipient} />
                    ))}
                  </datalist>
                </div>
                <input
                  type="date"
                  value={item.deliveryDate}
                  onChange={(e) => updateItem(index, 'deliveryDate', e.target.value)}
                  className="flex-1 p-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {newOrder.items.length > 1 && (
                  <button
                    onClick={() => removeItem(index)}
                    className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
            <div className="flex gap-2">
              <button
                onClick={addItemToOrder}
                className="mt-2 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
              >
                Add Item
              </button>
              <button
                onClick={addOrder}
                className="mt-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
              >
                Submit Order
              </button>
            </div>
          </div>

          <div className="mb-6 flex gap-4 items-center">
            <input
              type="text"
              placeholder="Search by Set Number or Item Name"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 p-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={() => setShowArchived(!showArchived)}
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
            >
              {showArchived ? 'Active Orders' : 'Archived Orders'}
            </button>
            <button
              onClick={generateBatchPDF}
              className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
            >
              Batch PDF
            </button>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-gray-700 mb-2">{showArchived ? 'Archived Orders' : 'Active Orders'}</h2>
            {filteredOrders.sort((a, b) => a.setNumber.localeCompare(b.setNumber)).map(order => (
              <div key={order.id} className="mb-4 p-4 bg-gray-50 rounded-lg shadow transition-all hover:shadow-md">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold text-gray-800">Set {order.setNumber}</h3>
                  <button
                    onClick={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}
                    className="px-2 py-1 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
                  >
                    {expandedOrder === order.id ? 'Collapse' : 'Expand'}
                  </button>
                </div>
                {expandedOrder === order.id && (
                  <div className="mt-2">
                    {order.items.map((item, index) => (
                      <p key={index} className="text-gray-600">
                        {item.name} for {item.for} (Expected: {item.deliveryDate})
                      </p>
                    ))}
                    {order.pickupPerson ? (
                      <p className="text-gray-600 mt-2">Picked up by {order.pickupPerson} at {new Date(order.pickupTime).toLocaleString()}</p>
                    ) : (
                      <div className="mt-2 flex gap-2">
                        <input
                          type="text"
                          placeholder="Pickup Person"
                          onBlur={(e) => markPickedUp(order.id, e.target.value)}
                          className="p-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    )}
                    <div className="mt-2 flex gap-2">
                      <button
                        onClick={() => generatePDF(order)}
                        className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
                      >
                        Generate PDF
                      </button>
                      <button
                        onClick={() => toggleArchive(order.id, !order.archived)}
                        className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600"
                      >
                        {order.archived ? 'Unarchive' : 'Archive'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
            {filteredOrders.length === 0 && (
              <p className="text-gray-500 text-center">No orders found.</p>
            )}
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
}

try {
  ReactDOM.render(<App />, document.getElementById('root'));
} catch (err) {
  console.error('Failed to render React app:', err);
  document.getElementById('root').innerHTML = '<div class="text-red-700 p-4 text-center">Error loading application. Please refresh the page.</div>';
}
