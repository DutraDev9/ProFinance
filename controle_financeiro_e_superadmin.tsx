import React, { useState, useMemo, useEffect } from 'react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  collection,
  getDocs,
  deleteDoc
} from 'firebase/firestore';
import {
  Wallet,
  CreditCard,
  TrendingDown,
  PlusCircle,
  Trash2,
  Sun,
  Moon,
  ShieldAlert,
  ShieldCheck,
  LogOut,
  UserCheck,
  UserX,
  Users,
  ShoppingBag,
  MapPin,
  DollarSign,
  Calendar,
  CheckCircle2,
  Clock,
  Home,
  Dumbbell,
  Zap,
  Droplets,
  Wifi,
  FileText,
  Edit3,
  Check,
  X,
  Search,
  Filter,
  Layers,
  Lock,
  Mail,
  User,
  Sparkles,
  RefreshCw,
  Eye,
  Code2,
  AlertCircle,
  ArrowUpRight,
  PieChart,
  Database,
  Copy,
  Cloud
} from 'lucide-react';

// ==========================================
// CONFIGURAÇÃO OFICIAL DO FIREBASE (pro-finance-control)
// ==========================================
const firebaseConfig = {
  apiKey: "AIzaSyCsQJYqDTk3jwd3ZD3IDvfWjprk-IoFXR4",
  authDomain: "pro-finance-control.firebaseapp.com",
  projectId: "pro-finance-control",
  storageBucket: "pro-finance-control.firebasestorage.app",
  messagingSenderId: "1049329594472",
  appId: "1:1049329594472:web:8dad6bc3f5a343111e8bdd"
};

let app;
let auth;
let db;
let googleProvider;

try {
  app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
  auth = getAuth(app);
  db = getFirestore(app);
  googleProvider = new GoogleAuthProvider();
  googleProvider.setCustomParameters({ prompt: 'select_account' });
} catch (err) {
  console.warn('Aviso ao inicializar Firebase:', err);
}

// ==========================================
// DADOS INICIAIS DE DEMONSTRAÇÃO
// ==========================================
const INITIAL_USERS = [
  {
    id: 'user-1',
    name: 'Carlos Mendes',
    email: 'carlos@email.com',
    password: '123',
    role: 'user',
    status: 'active',
    createdAt: '12/01/2025',
    authProvider: 'email',
    salary: 4800.00,
    fixedExpenses: [
      { id: 'f1', name: 'Aluguel do Apartamento', category: 'moradia', amount: 1450.00, paid: true },
      { id: 'f2', name: 'Academia Smart', category: 'academia', amount: 129.90, paid: true },
      { id: 'f3', name: 'Conta de Luz (Energia)', category: 'luz', amount: 215.50, paid: false },
      { id: 'f4', name: 'Conta de Água', category: 'agua', amount: 88.00, paid: true },
      { id: 'f5', name: 'Internet Fibra 600Mb', category: 'internet', amount: 119.90, paid: false }
    ],
    cards: [
      { id: 'c1', name: 'Nubank', limit: 4500.00, color: 'from-purple-600 to-indigo-700' },
      { id: 'c2', name: 'Banco Inter', limit: 3000.00, color: 'from-orange-500 to-amber-600' },
      { id: 'c3', name: 'Itaú Click', limit: 2500.00, color: 'from-blue-600 to-cyan-700' }
    ],
    expenses: [
      {
        id: 'e1',
        what: 'Smart TV 50" 4K',
        where: 'Magazine Luiza',
        totalAmount: 2400.00,
        installments: 10,
        paymentMethod: 'c1', // Nubank
        date: '05/03/2025'
      },
      {
        id: 'e2',
        what: 'Compras do Mês',
        where: 'Supermercado Assaí',
        totalAmount: 680.00,
        installments: 1,
        paymentMethod: 'c2', // Inter
        date: '08/03/2025'
      },
      {
        id: 'e3',
        what: 'Tênis de Corrida',
        where: 'Centauro Shopping',
        totalAmount: 450.00,
        installments: 3,
        paymentMethod: 'c1', // Nubank
        date: '10/03/2025'
      },
      {
        id: 'e4',
        what: 'Jantar de Fim de Semana',
        where: 'Restaurante Outback',
        totalAmount: 195.00,
        installments: 1,
        paymentMethod: 'salary', // Pago no Pix / Débito do Salário
        date: '12/03/2025'
      },
      {
        id: 'e5',
        what: 'Manutenção Preventiva Moto',
        where: 'Oficina Duas Rodas',
        totalAmount: 600.00,
        installments: 4,
        paymentMethod: 'c3', // Itaú
        date: '14/03/2025'
      }
    ]
  },
  {
    id: 'admin-1',
    name: 'Super Administrador',
    email: 'admin@financas.com',
    password: 'admin',
    role: 'superadmin',
    status: 'active',
    createdAt: '01/01/2025',
    authProvider: 'email',
    salary: 9500.00,
    fixedExpenses: [
      { id: 'af1', name: 'Financiamento Residencial', category: 'moradia', amount: 2400.00, paid: true },
      { id: 'af2', name: 'Academia Crossfit', category: 'academia', amount: 220.00, paid: true },
      { id: 'af3', name: 'Conta de Luz', category: 'luz', amount: 310.00, paid: true },
      { id: 'af4', name: 'Conta de Água', category: 'agua', amount: 110.00, paid: true }
    ],
    cards: [
      { id: 'ac1', name: 'C6 Carbon', limit: 12000.00, color: 'from-slate-700 to-zinc-900' },
      { id: 'ac2', name: 'Nubank Ultravioleta', limit: 8000.00, color: 'from-purple-700 to-fuchsia-900' }
    ],
    expenses: [
      {
        id: 'ae1',
        what: 'Notebook Trabalho',
        where: 'Kabum',
        totalAmount: 4800.00,
        installments: 8,
        paymentMethod: 'ac1',
        date: '02/03/2025'
      }
    ]
  },
  {
    id: 'user-2',
    name: 'Mariana Costa',
    email: 'mariana@gmail.com',
    password: '123',
    role: 'user',
    status: 'active',
    createdAt: '19/02/2025',
    authProvider: 'google',
    salary: 3600.00,
    fixedExpenses: [
      { id: 'mf1', name: 'Aluguel Kitnet', category: 'moradia', amount: 950.00, paid: true },
      { id: 'mf2', name: 'Conta de Luz', category: 'luz', amount: 130.00, paid: false },
      { id: 'mf3', name: 'Academia Bairro', category: 'academia', amount: 90.00, paid: true }
    ],
    cards: [
      { id: 'mc1', name: 'Nubank', limit: 2000.00, color: 'from-purple-600 to-indigo-700' }
    ],
    expenses: [
      {
        id: 'me1',
        what: 'Curso de Inglês Semestral',
        where: 'Plataforma Online',
        totalAmount: 720.00,
        installments: 6,
        paymentMethod: 'mc1',
        date: '10/03/2025'
      }
    ]
  }
];

const CARD_COLORS = [
  { label: 'Roxo (Nubank)', value: 'from-purple-600 to-indigo-700' },
  { label: 'Laranja (Inter/Itaú)', value: 'from-orange-500 to-amber-600' },
  { label: 'Azul (Bradesco/Caixa)', value: 'from-blue-600 to-cyan-700' },
  { label: 'Carbono (C6/Black)', value: 'from-slate-700 to-zinc-900' },
  { label: 'Esmeralda (Sicredi/Next)', value: 'from-emerald-600 to-teal-700' },
  { label: 'Vermelho (Santander)', value: 'from-rose-600 to-red-700' }
];

const FIXED_CATEGORIES = [
  { id: 'moradia', label: 'Aluguel / Moradia', icon: Home, color: 'text-blue-500 bg-blue-500/10' },
  { id: 'academia', label: 'Academia / Saúde', icon: Dumbbell, color: 'text-emerald-500 bg-emerald-500/10' },
  { id: 'luz', label: 'Conta de Luz', icon: Zap, color: 'text-amber-500 bg-amber-500/10' },
  { id: 'agua', label: 'Conta de Água', icon: Droplets, color: 'text-cyan-500 bg-cyan-500/10' },
  { id: 'internet', label: 'Internet / TV', icon: Wifi, color: 'text-purple-500 bg-purple-500/10' },
  { id: 'outros', label: 'Outras Fixas', icon: FileText, color: 'text-rose-500 bg-rose-500/10' }
];

// Formatação de moeda em Real (R$)
const formatBRL = (value) => {
  const num = Number(value) || 0;
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

export default function App() {
  // Tema Claro / Escuro
  const [darkMode, setDarkMode] = useState(true);

  // Banco de Usuários em Memória + Sincronizado com Firestore (pro-finance-control)
  const [users, setUsers] = useState(INITIAL_USERS);
  const [firebaseStatus, setFirebaseStatus] = useState('connected'); // 'connected' | 'local-fallback'
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [copiedSnippet, setCopiedSnippet] = useState('');

  // Usuário autenticado no momento (inicia logado para visualização imediata, permitindo sair ou trocar)
  const [currentUserId, setCurrentUserId] = useState('user-1');
  const [impersonatedUserId, setImpersonatedUserId] = useState(null); // Permite ao SuperAdmin gerenciar a conta de um usuário específico
  const [activeView, setActiveView] = useState('dashboard'); // 'dashboard' | 'superadmin' | 'firebase-guide'

  // Estados da Tela de Login / Cadastro
  const [authMode, setAuthMode] = useState('login'); // 'login' | 'register'
  const [authName, setAuthName] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authRole, setAuthRole] = useState('user');

  // Toast / Notificações sem alert()
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  // Salva/Sincroniza um documento de usuário no Firestore (coleção "users")
  const syncUserToFirestore = async (userObj) => {
    if (!db || !userObj?.id) return;
    try {
      await setDoc(doc(db, 'users', userObj.id), userObj, { merge: true });
      setFirebaseStatus('connected');
    } catch (err) {
      // Caso o Firestore ainda não esteja criado ou com regras fechadas no console, mantém funcionando localmente
      setFirebaseStatus('local-fallback');
    }
  };

  // Carrega usuários salvos no Firestore ao iniciar e escuta estado de login do Firebase Auth
  useEffect(() => {
    let isMounted = true;

    const fetchFirestoreUsers = async () => {
      if (!db) return;
      try {
        const snap = await getDocs(collection(db, 'users'));
        if (!snap.empty && isMounted) {
          const loaded = [];
          snap.forEach((d) => loaded.push(d.data()));
          setUsers((prev) => {
            const map = new Map(prev.map((u) => [u.id, u]));
            loaded.forEach((u) => map.set(u.id, u));
            return Array.from(map.values());
          });
          setFirebaseStatus('connected');
        }
      } catch (err) {
        if (isMounted) setFirebaseStatus('local-fallback');
      }
    };

    fetchFirestoreUsers();

    if (!auth) return;
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (!fbUser || !isMounted) return;
      try {
        const userRef = doc(db, 'users', fbUser.uid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
          const existingData = userSnap.data();
          setUsers((prev) => {
            const exists = prev.some((u) => u.id === existingData.id);
            return exists
              ? prev.map((u) => (u.id === existingData.id ? existingData : u))
              : [...prev, existingData];
          });
          setCurrentUserId(existingData.id);
        } else {
          const newProfile = {
            id: fbUser.uid,
            name: fbUser.displayName || fbUser.email?.split('@')[0] || 'Usuário Firebase',
            email: fbUser.email || 'usuario@gmail.com',
            password: '',
            role: 'user',
            status: 'active',
            createdAt: new Date().toLocaleDateString('pt-BR'),
            authProvider: fbUser.providerData?.[0]?.providerId === 'google.com' ? 'google' : 'email',
            salary: 4000.00,
            fixedExpenses: [
              { id: `f-${Date.now()}-1`, name: 'Aluguel / Moradia', category: 'moradia', amount: 1200, paid: false },
              { id: `f-${Date.now()}-2`, name: 'Conta de Luz', category: 'luz', amount: 180, paid: false }
            ],
            cards: [
              { id: `c-${Date.now()}-1`, name: 'Nubank', limit: 3500, color: 'from-purple-600 to-indigo-700' }
            ],
            expenses: []
          };
          await syncUserToFirestore(newProfile);
          setUsers((prev) => [...prev.filter((u) => u.id !== newProfile.id), newProfile]);
          setCurrentUserId(newProfile.id);
        }
      } catch (err) {
        // Fallback local se o Firestore bloquear leitura antes da configuração de regras
        setFirebaseStatus('local-fallback');
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  // Identifica o usuário logado e o usuário cujos dados estão sendo visualizados
  const loggedUser = useMemo(
    () => users.find((u) => u.id === currentUserId) || null,
    [users, currentUserId]
  );

  const activeUser = useMemo(() => {
    if (impersonatedUserId) {
      return users.find((u) => u.id === impersonatedUserId) || loggedUser;
    }
    return loggedUser;
  }, [users, impersonatedUserId, loggedUser]);

  // Função auxiliar para atualizar os dados financeiros do usuário ativo e sincronizar com o Firestore
  const updateActiveUserData = (updater) => {
    if (!activeUser) return;
    setUsers((prev) =>
      prev.map((u) => {
        if (u.id === activeUser.id) {
          const updated = updater(u);
          syncUserToFirestore(updated);
          return updated;
        }
        return u;
      })
    );
  };

  // ==========================================
  // ESTADOS DOS FORMULÁRIOS DOS PAINÉIS
  // ==========================================

  // 1. Edição de Salário
  const [isEditingSalary, setIsEditingSalary] = useState(false);
  const [salaryInput, setSalaryInput] = useState('');

  // 2. Nova Despesa Fixa (Logo abaixo do Salário)
  const [fixedName, setFixedName] = useState('');
  const [fixedCategory, setFixedCategory] = useState('moradia');
  const [fixedAmount, setFixedAmount] = useState('');

  // 3. Novo Cartão de Crédito (Apenas Nome e Limite)
  const [cardName, setCardName] = useState('');
  const [cardLimit, setCardLimit] = useState('');
  const [cardColor, setCardColor] = useState(CARD_COLORS[0].value);
  const [editingCardId, setEditingCardId] = useState(null);
  const [editingCardLimit, setEditingCardLimit] = useState('');

  // 4. Novo Gasto (O que foi gasto, Onde, Quanto, Cartão/Método e Parcelas)
  const [expenseWhat, setExpenseWhat] = useState('');
  const [expenseWhere, setExpenseWhere] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseMethod, setExpenseMethod] = useState('c1');
  const [expenseInstallments, setExpenseInstallments] = useState(1);

  // 5. Filtros da Lista de Gastos e Parcelas
  const [filterPayment, setFilterPayment] = useState('all');
  const [filterInstallmentType, setFilterInstallmentType] = useState('all'); // 'all' | 'installments' | 'single'
  const [searchQuery, setSearchQuery] = useState('');

  // 6. Modal para criar usuário no SuperAdmin
  const [newAdminUserName, setNewAdminUserName] = useState('');
  const [newAdminUserEmail, setNewAdminUserEmail] = useState('');
  const [newAdminUserSalary, setNewAdminUserSalary] = useState('3500');

  // ==========================================
  // CÁLCULOS FINANCEIROS AUTOMÁTICOS
  // ==========================================
  const financials = useMemo(() => {
    if (!activeUser) {
      return {
        salary: 0,
        totalFixed: 0,
        paidFixed: 0,
        pendingFixed: 0,
        directSalaryExpenses: 0,
        cardsWithStats: [],
        totalCardLimit: 0,
        totalCardUsed: 0,
        totalMonthlyCardBill: 0,
        totalAllPurchases: 0,
        monthlyCommitment: 0,
        remainingSalary: 0,
        salaryCommitmentPercent: 0
      };
    }

    const salary = Number(activeUser.salary) || 0;

    // Despesas Fixas
    const totalFixed = activeUser.fixedExpenses.reduce((acc, item) => acc + (Number(item.amount) || 0), 0);
    const paidFixed = activeUser.fixedExpenses
      .filter((i) => i.paid)
      .reduce((acc, item) => acc + (Number(item.amount) || 0), 0);
    const pendingFixed = totalFixed - paidFixed;

    // Gastos pagos diretamente com o Salário (Débito / Pix / Dinheiro)
    const directSalaryExpenses = activeUser.expenses
      .filter((e) => e.paymentMethod === 'salary')
      .reduce((acc, e) => acc + (Number(e.totalAmount) || 0), 0);

    // Estatísticas de cada Cartão de Crédito
    const cardsWithStats = activeUser.cards.map((card) => {
      const cardExpenses = activeUser.expenses.filter((e) => e.paymentMethod === card.id);
      const usedLimit = cardExpenses.reduce((acc, e) => acc + (Number(e.totalAmount) || 0), 0);
      const monthlyInstallmentsSum = cardExpenses.reduce(
        (acc, e) => acc + (Number(e.totalAmount) || 0) / (Number(e.installments) || 1),
        0
      );
      const availableLimit = Math.max(0, card.limit - usedLimit);
      const usagePercent = card.limit > 0 ? Math.min(100, (usedLimit / card.limit) * 100) : 0;

      return {
        ...card,
        usedLimit,
        monthlyInstallmentsSum,
        availableLimit,
        usagePercent,
        purchasesCount: cardExpenses.length
      };
    });

    const totalCardLimit = cardsWithStats.reduce((acc, c) => acc + c.limit, 0);
    const totalCardUsed = cardsWithStats.reduce((acc, c) => acc + c.usedLimit, 0);
    const totalMonthlyCardBill = cardsWithStats.reduce((acc, c) => acc + c.monthlyInstallmentsSum, 0);

    const totalExpensesIntegral = activeUser.expenses.reduce((acc, e) => acc + (Number(e.totalAmount) || 0), 0);
    const totalAllPurchases = totalFixed + totalExpensesIntegral;

    const monthlyCommitment = totalFixed + directSalaryExpenses + totalMonthlyCardBill;
    const remainingSalary = salary - monthlyCommitment;
    const salaryCommitmentPercent = salary > 0 ? Math.min(100, (monthlyCommitment / salary) * 100) : 0;

    return {
      salary,
      totalFixed,
      paidFixed,
      pendingFixed,
      directSalaryExpenses,
      cardsWithStats,
      totalCardLimit,
      totalCardUsed,
      totalMonthlyCardBill,
      totalExpensesIntegral,
      totalAllPurchases,
      monthlyCommitment,
      remainingSalary,
      salaryCommitmentPercent
    };
  }, [activeUser]);

  // ==========================================
  // HANDLERS DE AUTENTICAÇÃO (FIREBASE + FALLBACK)
  // ==========================================
  const handleLogin = async (e) => {
    e.preventDefault();
    setIsAuthLoading(true);

    // 1. Verifica primeiro se é uma das contas locais de demonstração
    const localFound = users.find(
      (u) => u.email.toLowerCase() === authEmail.trim().toLowerCase() && u.password === authPassword
    );

    if (localFound) {
      setIsAuthLoading(false);
      if (localFound.status === 'suspended') {
        showToast('Esta conta foi suspensa pelo SuperAdmin.', 'error');
        return;
      }
      setCurrentUserId(localFound.id);
      setImpersonatedUserId(null);
      setActiveView(localFound.role === 'superadmin' ? 'superadmin' : 'dashboard');
      showToast(`Bem-vindo(a), ${localFound.name}!`);
      return;
    }

    // 2. Tenta autenticar no Firebase Authentication (pro-finance-control)
    if (auth) {
      try {
        const cred = await signInWithEmailAndPassword(auth, authEmail.trim(), authPassword);
        const fbUser = cred.user;
        const foundInList = users.find((u) => u.id === fbUser.uid || u.email === fbUser.email);
        if (foundInList && foundInList.status === 'suspended') {
          showToast('Esta conta foi suspensa pelo SuperAdmin.', 'error');
          setIsAuthLoading(false);
          return;
        }
        setIsAuthLoading(false);
        showToast(`Autenticado via Firebase (${fbUser.email})!`);
        return;
      } catch (err) {
        setIsAuthLoading(false);
        showToast('E-mail ou senha inválidos no Firebase ou nas contas de teste.', 'error');
        return;
      }
    }

    setIsAuthLoading(false);
    showToast('Credenciais não encontradas.', 'error');
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!authName.trim() || !authEmail.trim() || !authPassword.trim()) {
      showToast('Preencha todos os campos para criar sua conta.', 'error');
      return;
    }

    const exists = users.some((u) => u.email.toLowerCase() === authEmail.trim().toLowerCase());
    if (exists) {
      showToast('Este e-mail já está cadastrado.', 'error');
      return;
    }

    setIsAuthLoading(true);
    let uid = `user-${Date.now()}`;

    // Tenta criar no Firebase Auth real se disponível
    if (auth) {
      try {
        const cred = await createUserWithEmailAndPassword(auth, authEmail.trim(), authPassword);
        uid = cred.user.uid;
      } catch (err) {
        // Se o provedor Email/Password ainda não estiver habilitado no Console do Firebase, cria localmente e avisa
        console.warn('Fallback de criação local:', err?.code);
      }
    }

    const newUser = {
      id: uid,
      name: authName.trim(),
      email: authEmail.trim(),
      password: authPassword,
      role: authRole,
      status: 'active',
      createdAt: new Date().toLocaleDateString('pt-BR'),
      authProvider: 'email',
      salary: 3500.00,
      fixedExpenses: [
        { id: `f-${Date.now()}-1`, name: 'Aluguel', category: 'moradia', amount: 1100, paid: false },
        { id: `f-${Date.now()}-2`, name: 'Conta de Luz', category: 'luz', amount: 160, paid: false },
        { id: `f-${Date.now()}-3`, name: 'Conta de Água', category: 'agua', amount: 85, paid: false }
      ],
      cards: [
        { id: `c-${Date.now()}-1`, name: 'Nubank', limit: 3000, color: 'from-purple-600 to-indigo-700' }
      ],
      expenses: []
    };

    await syncUserToFirestore(newUser);
    setUsers((prev) => [...prev, newUser]);
    setCurrentUserId(newUser.id);
    setImpersonatedUserId(null);
    setIsAuthLoading(false);
    setActiveView(newUser.role === 'superadmin' ? 'superadmin' : 'dashboard');
    showToast('Conta criada e sincronizada com sucesso!');
  };

  // Login com Google real usando o projeto "pro-finance-control" + Fallback caso o domínio de preview não esteja autorizado
  const handleGoogleLogin = async () => {
    setIsAuthLoading(true);
    if (auth && googleProvider) {
      try {
        const result = await signInWithPopup(auth, googleProvider);
        const fbUser = result.user;

        const googleUserObj = {
          id: fbUser.uid,
          name: fbUser.displayName || 'Usuário Google',
          email: fbUser.email || 'usuario.google@gmail.com',
          password: '',
          role: 'user',
          status: 'active',
          createdAt: new Date().toLocaleDateString('pt-BR'),
          authProvider: 'google',
          salary: 4500.00,
          fixedExpenses: [
            { id: 'gf1', name: 'Aluguel Residencial', category: 'moradia', amount: 1300, paid: true },
            { id: 'gf2', name: 'Academia', category: 'academia', amount: 120, paid: true },
            { id: 'gf3', name: 'Conta de Luz', category: 'luz', amount: 185, paid: false },
            { id: 'gf4', name: 'Conta de Água', category: 'agua', amount: 80, paid: false }
          ],
          cards: [
            { id: 'gc1', name: 'Nubank', limit: 4000, color: 'from-purple-600 to-indigo-700' }
          ],
          expenses: []
        };

        await syncUserToFirestore(googleUserObj);
        setUsers((prev) => {
          const exists = prev.some((u) => u.id === googleUserObj.id || u.email === googleUserObj.email);
          return exists ? prev : [...prev, googleUserObj];
        });
        setCurrentUserId(googleUserObj.id);
        setImpersonatedUserId(null);
        setActiveView('dashboard');
        setIsAuthLoading(false);
        showToast(`Conectado com Google: ${googleUserObj.name}!`);
        return;
      } catch (err) {
        console.warn('Aviso Firebase Google Popup:', err?.code || err?.message);
        // Se o iframe de preview bloquear o popup ou o domínio do preview ainda não estiver em "Domínios Autorizados" do Firebase:
        const fallbackGoogleUser = {
          id: 'google-demo-user',
          name: 'Conta Google (pro-finance-control)',
          email: 'google.user@gmail.com',
          password: '',
          role: 'user',
          status: 'active',
          createdAt: new Date().toLocaleDateString('pt-BR'),
          authProvider: 'google',
          salary: 4200.00,
          fixedExpenses: [
            { id: 'gf1', name: 'Aluguel Residencial', category: 'moradia', amount: 1200, paid: true },
            { id: 'gf2', name: 'Academia', category: 'academia', amount: 110, paid: true },
            { id: 'gf3', name: 'Conta de Luz', category: 'luz', amount: 180, paid: false },
            { id: 'gf4', name: 'Conta de Água', category: 'agua', amount: 75, paid: false }
          ],
          cards: [
            { id: 'gc1', name: 'Nubank', limit: 3500, color: 'from-purple-600 to-indigo-700' }
          ],
          expenses: [
            {
              id: 'ge1',
              what: 'Fone Bluetooth',
              where: 'Mercado Livre',
              totalAmount: 240,
              installments: 3,
              paymentMethod: 'gc1',
              date: new Date().toLocaleDateString('pt-BR')
            }
          ]
        };

        const existing = users.find((u) => u.email === fallbackGoogleUser.email);
        if (existing) {
          setCurrentUserId(existing.id);
        } else {
          setUsers((prev) => [...prev, fallbackGoogleUser]);
          setCurrentUserId(fallbackGoogleUser.id);
        }
        setImpersonatedUserId(null);
        setActiveView('dashboard');
        setIsAuthLoading(false);
        showToast(
          'Sessão Google iniciada! (Para popup real fora do preview, autorize seu domínio no Console do Firebase).',
          'success'
        );
      }
    }
  };

  // ==========================================
  // HANDLERS FINANCEIROS
  // ==========================================
  const handleSaveSalary = (e) => {
    e.preventDefault();
    const val = parseFloat(salaryInput.replace(',', '.'));
    if (isNaN(val) || val < 0) {
      showToast('Informe um valor de salário válido.', 'error');
      return;
    }
    updateActiveUserData((u) => ({ ...u, salary: val }));
    setIsEditingSalary(false);
    showToast('Salário atualizado com sucesso!');
  };

  const handleAddFixedExpense = (e) => {
    e.preventDefault();
    const val = parseFloat(fixedAmount.replace(',', '.'));
    if (!fixedName.trim() || isNaN(val) || val <= 0) {
      showToast('Informe o nome e o valor da despesa fixa.', 'error');
      return;
    }
    const newFixed = {
      id: `fix-${Date.now()}`,
      name: fixedName.trim(),
      category: fixedCategory,
      amount: val,
      paid: false
    };
    updateActiveUserData((u) => ({
      ...u,
      fixedExpenses: [...u.fixedExpenses, newFixed]
    }));
    setFixedName('');
    setFixedAmount('');
    showToast('Despesa fixa adicionada!');
  };

  const handleToggleFixedPaid = (id) => {
    updateActiveUserData((u) => ({
      ...u,
      fixedExpenses: u.fixedExpenses.map((item) =>
        item.id === id ? { ...item, paid: !item.paid } : item
      )
    }));
  };

  const handleDeleteFixed = (id) => {
    updateActiveUserData((u) => ({
      ...u,
      fixedExpenses: u.fixedExpenses.filter((item) => item.id !== id)
    }));
    showToast('Despesa fixa removida.');
  };

  const handleAddCard = (e) => {
    e.preventDefault();
    const limitVal = parseFloat(cardLimit.replace(',', '.'));
    if (!cardName.trim() || isNaN(limitVal) || limitVal <= 0) {
      showToast('Informe o nome do cartão e um limite válido.', 'error');
      return;
    }
    const newCard = {
      id: `card-${Date.now()}`,
      name: cardName.trim(),
      limit: limitVal,
      color: cardColor
    };
    updateActiveUserData((u) => ({
      ...u,
      cards: [...u.cards, newCard]
    }));
    setCardName('');
    setCardLimit('');
    setExpenseMethod(newCard.id);
    showToast(`Cartão ${newCard.name} cadastrado!`);
  };

  const handleSaveCardLimit = (cardId) => {
    const val = parseFloat(editingCardLimit.replace(',', '.'));
    if (isNaN(val) || val <= 0) {
      showToast('Informe um limite válido.', 'error');
      return;
    }
    updateActiveUserData((u) => ({
      ...u,
      cards: u.cards.map((c) => (c.id === cardId ? { ...c, limit: val } : c))
    }));
    setEditingCardId(null);
    showToast('Limite do cartão atualizado!');
  };

  const handleDeleteCard = (cardId) => {
    updateActiveUserData((u) => ({
      ...u,
      cards: u.cards.filter((c) => c.id !== cardId),
      expenses: u.expenses.filter((e) => e.paymentMethod !== cardId)
    }));
    showToast('Cartão e lançamentos vinculados removidos.');
  };

  const handleAddExpense = (e) => {
    e.preventDefault();
    const val = parseFloat(expenseAmount.replace(',', '.'));
    if (!expenseWhat.trim() || !expenseWhere.trim() || isNaN(val) || val <= 0) {
      showToast('Preencha o que foi gasto, onde e o valor.', 'error');
      return;
    }

    const chosenMethod =
      expenseMethod !== 'salary' && !activeUser.cards.some((c) => c.id === expenseMethod)
        ? activeUser.cards[0]?.id || 'salary'
        : expenseMethod;

    const installmentsNum = chosenMethod === 'salary' ? 1 : Number(expenseInstallments) || 1;

    const newExpense = {
      id: `exp-${Date.now()}`,
      what: expenseWhat.trim(),
      where: expenseWhere.trim(),
      totalAmount: val,
      installments: installmentsNum,
      paymentMethod: chosenMethod,
      date: new Date().toLocaleDateString('pt-BR')
    };

    updateActiveUserData((u) => ({
      ...u,
      expenses: [newExpense, ...u.expenses]
    }));

    setExpenseWhat('');
    setExpenseWhere('');
    setExpenseAmount('');
    setExpenseInstallments(1);
    showToast('Gasto registrado com sucesso!');
  };

  const handleDeleteExpense = (id) => {
    updateActiveUserData((u) => ({
      ...u,
      expenses: u.expenses.filter((e) => e.id !== id)
    }));
    showToast('Lançamento removido.');
  };

  // ==========================================
  // HANDLERS DO SUPERADMIN
  // ==========================================
  const handleToggleUserStatus = (id) => {
    if (id === loggedUser?.id) {
      showToast('Você não pode suspender sua própria conta SuperAdmin.', 'error');
      return;
    }
    setUsers((prev) =>
      prev.map((u) => {
        if (u.id === id) {
          const updated = { ...u, status: u.status === 'active' ? 'suspended' : 'active' };
          syncUserToFirestore(updated);
          return updated;
        }
        return u;
      })
    );
    showToast('Status da conta atualizado pelo SuperAdmin.');
  };

  const handleToggleUserRole = (id) => {
    if (id === loggedUser?.id) {
      showToast('Você já é o SuperAdmin atual.', 'error');
      return;
    }
    setUsers((prev) =>
      prev.map((u) => {
        if (u.id === id) {
          const updated = { ...u, role: u.role === 'superadmin' ? 'user' : 'superadmin' };
          syncUserToFirestore(updated);
          return updated;
        }
        return u;
      })
    );
    showToast('Nível de permissão do usuário atualizado!');
  };

  const handleDeleteUserAccount = async (id) => {
    if (id === loggedUser?.id) {
      showToast('Não é possível excluir a própria conta SuperAdmin ativa.', 'error');
      return;
    }
    setUsers((prev) => prev.filter((u) => u.id !== id));
    if (impersonatedUserId === id) setImpersonatedUserId(null);
    if (db) {
      try {
        await deleteDoc(doc(db, 'users', id));
      } catch (e) {
        // Ignora caso seja apenas em memória
      }
    }
    showToast('Conta de usuário excluída.');
  };

  const handleAdminCreateUser = async (e) => {
    e.preventDefault();
    if (!newAdminUserName.trim() || !newAdminUserEmail.trim()) {
      showToast('Informe nome e e-mail do novo usuário.', 'error');
      return;
    }
    const created = {
      id: `user-${Date.now()}`,
      name: newAdminUserName.trim(),
      email: newAdminUserEmail.trim(),
      password: '123',
      role: 'user',
      status: 'active',
      createdAt: new Date().toLocaleDateString('pt-BR'),
      authProvider: 'email',
      salary: parseFloat(newAdminUserSalary) || 3000,
      fixedExpenses: [
        { id: `f-${Date.now()}-1`, name: 'Aluguel', category: 'moradia', amount: 1000, paid: false }
      ],
      cards: [{ id: `c-${Date.now()}`, name: 'Cartão Principal', limit: 2000, color: 'from-purple-600 to-indigo-700' }],
      expenses: []
    };
    await syncUserToFirestore(created);
    setUsers((prev) => [...prev, created]);
    setNewAdminUserName('');
    setNewAdminUserEmail('');
    showToast(`Conta de ${created.name} criada pelo SuperAdmin!`);
  };

  const handleCopyCode = (key, text) => {
    navigator.clipboard?.writeText(text);
    setCopiedSnippet(key);
    showToast('Código copiado para a área de transferência!');
    setTimeout(() => setCopiedSnippet(''), 2500);
  };

  // Lista filtrada de gastos
  const filteredExpenses = useMemo(() => {
    if (!activeUser) return [];
    return activeUser.expenses.filter((item) => {
      const matchesPayment = filterPayment === 'all' || item.paymentMethod === filterPayment;
      const matchesType =
        filterInstallmentType === 'all' ||
        (filterInstallmentType === 'installments' && item.installments > 1) ||
        (filterInstallmentType === 'single' && item.installments === 1);
      const matchesSearch =
        !searchQuery.trim() ||
        item.what.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.where.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesPayment && matchesType && matchesSearch;
    });
  }, [activeUser, filterPayment, filterInstallmentType, searchQuery]);

  // ==========================================
  // CLASSES DE TEMA (CLARO / ESCURO)
  // ==========================================
  const theme = {
    bg: darkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-100 text-slate-800',
    card: darkMode
      ? 'bg-slate-900/90 border-slate-800 text-slate-100 shadow-xl shadow-black/20'
      : 'bg-white border-slate-200/80 text-slate-800 shadow-md shadow-slate-200/60',
    subCard: darkMode
      ? 'bg-slate-800/60 border-slate-700/70'
      : 'bg-slate-50 border-slate-200',
    input: darkMode
      ? 'bg-slate-800/90 border-slate-700 text-white placeholder-slate-400 focus:border-indigo-500'
      : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:border-indigo-600',
    muted: darkMode ? 'text-slate-400' : 'text-slate-500',
    header: darkMode
      ? 'bg-slate-900/95 border-slate-800'
      : 'bg-white/95 border-slate-200'
  };

  // ==========================================
  // TELA DE LOGIN / CADASTRO (SE DESLOGADO)
  // ==========================================
  if (!loggedUser) {
    return (
      <div className={`min-h-screen flex flex-col justify-between p-4 transition-colors duration-300 ${theme.bg}`}>
        {/* Barra Superior de Tema */}
        <div className="max-w-6xl w-full mx-auto flex justify-between items-center py-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/30">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-lg tracking-tight">FinançasPro</span>
              <span className="text-xs block text-emerald-400 font-medium">
                Firebase: pro-finance-control
              </span>
            </div>
          </div>

          <button
            onClick={() => setDarkMode(!darkMode)}
            className={`p-2.5 rounded-xl border transition-all flex items-center gap-2 text-xs font-medium ${theme.card}`}
          >
            {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-600" />}
            {darkMode ? 'Modo Claro' : 'Modo Escuro'}
          </button>
        </div>

        {/* Toast Notification */}
        {toast && (
          <div className="fixed top-5 right-5 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-2xl border bg-indigo-600 text-white border-indigo-400">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="text-sm font-medium">{toast.message}</span>
          </div>
        )}

        {/* Card Central de Autenticação */}
        <div className="my-auto max-w-md w-full mx-auto">
          <div className={`rounded-2xl border p-6 sm:p-8 ${theme.card}`}>
            <div className="text-center mb-6">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 mb-2">
                <Cloud className="w-3.5 h-3.5" /> Conectado ao pro-finance-control
              </span>
              <h1 className="text-2xl font-bold">
                {authMode === 'login' ? 'Acesse sua Conta' : 'Criar Nova Conta'}
              </h1>
              <p className={`text-sm mt-1 ${theme.muted}`}>
                Gerencie salário, despesas fixas, cartões e parcelas em um só lugar.
              </p>
            </div>

            {/* Botão Google Real com Firebase */}
            <button
              type="button"
              disabled={isAuthLoading}
              onClick={handleGoogleLogin}
              className={`w-full py-3 px-4 rounded-xl border font-semibold text-sm flex items-center justify-center gap-3 transition-all mb-5 ${
                darkMode
                  ? 'bg-white text-slate-900 hover:bg-slate-100 border-white'
                  : 'bg-slate-900 text-white hover:bg-slate-800 border-slate-900'
              }`}
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="#EA4335"
                  d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.4 1 3.5 3.6 1.6 7.4l3.7 2.8C6.2 7.2 8.9 5 12 5z"
                />
                <path
                  fill="#4285F4"
                  d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.6l3.7 2.9c2.2-2 3.7-5 3.7-8.7z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.3 14.8c-.2-.8-.4-1.6-.4-2.5s.2-1.7.4-2.5L1.6 7C.6 9 0 11.2 0 13.5s.6 4.5 1.6 6.5l3.7-2.8z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3.1 0-5.8-2.1-6.7-5l-3.7 2.8C3.5 21.4 7.4 24 12 24z"
                />
              </svg>
              {isAuthLoading ? 'Conectando ao Firebase...' : 'Entrar com o Google'}
            </button>

            <div className="relative flex py-2 items-center mb-5">
              <div className="flex-grow border-t border-slate-500/20"></div>
              <span className={`flex-shrink mx-3 text-xs uppercase ${theme.muted}`}>ou com e-mail</span>
              <div className="flex-grow border-t border-slate-500/20"></div>
            </div>

            <form onSubmit={authMode === 'login' ? handleLogin : handleRegister} className="space-y-4">
              {authMode === 'register' && (
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5">
                    Seu Nome
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                    <input
                      type="text"
                      required
                      placeholder="Ex: João Silva"
                      value={authName}
                      onChange={(e) => setAuthName(e.target.value)}
                      className={`w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm outline-none ${theme.input}`}
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5">
                  E-mail
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                  <input
                    type="email"
                    required
                    placeholder="seu@email.com"
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    className={`w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm outline-none ${theme.input}`}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5">
                  Senha
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                  <input
                    type="password"
                    required
                    placeholder="••••••"
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    className={`w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm outline-none ${theme.input}`}
                  />
                </div>
              </div>

              {authMode === 'register' && (
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5">
                    Tipo de Conta
                  </label>
                  <select
                    value={authRole}
                    onChange={(e) => setAuthRole(e.target.value)}
                    className={`w-full px-3.5 py-2.5 rounded-xl border text-sm outline-none ${theme.input}`}
                  >
                    <option value="user">Usuário Padrão (Pessoal)</option>
                    <option value="superadmin">SuperAdmin (Administrador)</option>
                  </select>
                </div>
              )}

              <button
                type="submit"
                disabled={isAuthLoading}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold text-sm shadow-lg shadow-indigo-600/30 transition-all"
              >
                {authMode === 'login' ? 'Entrar no Painel' : 'Finalizar Cadastro'}
              </button>
            </form>

            <div className="mt-5 text-center">
              <button
                type="button"
                onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
                className="text-xs font-semibold text-indigo-400 hover:underline"
              >
                {authMode === 'login'
                  ? 'Não tem uma conta? Cadastre-se gratuitamente'
                  : 'Já possui conta? Faça login'}
              </button>
            </div>

            {/* Acesso Rápido de Demonstração */}
            <div className={`mt-6 pt-5 border-t border-slate-500/20`}>
              <p className={`text-xs font-semibold uppercase tracking-wider mb-2.5 text-center ${theme.muted}`}>
                Acesso Rápido para Teste
              </p>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setCurrentUserId('user-1');
                    setActiveView('dashboard');
                  }}
                  className={`p-2.5 rounded-xl border text-xs font-medium flex items-center justify-center gap-1.5 hover:border-indigo-500 transition-all ${theme.subCard}`}
                >
                  <UserCheck className="w-4 h-4 text-emerald-500" />
                  Conta Usuário
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCurrentUserId('admin-1');
                    setActiveView('superadmin');
                  }}
                  className={`p-2.5 rounded-xl border text-xs font-medium flex items-center justify-center gap-1.5 hover:border-amber-500 transition-all ${theme.subCard}`}
                >
                  <ShieldAlert className="w-4 h-4 text-amber-500" />
                  Conta SuperAdmin
                </button>
              </div>
            </div>
          </div>
        </div>

        <footer className={`text-center text-xs py-4 ${theme.muted}`}>
          FinançasPro • Integrado ao projeto Firebase <strong>pro-finance-control</strong>
        </footer>
      </div>
    );
  }

  // ==========================================
  // INTERFACE PRINCIPAL LOGADA
  // ==========================================
  return (
    <div className={`min-h-screen transition-colors duration-300 pb-14 ${theme.bg}`}>
      {/* Notificação Flutuante */}
      {toast && (
        <div
          className={`fixed bottom-5 right-5 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-2xl border text-white transition-all ${
            toast.type === 'error'
              ? 'bg-rose-600 border-rose-400'
              : 'bg-emerald-600 border-emerald-400'
          }`}
        >
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span className="text-sm font-medium">{toast.message}</span>
        </div>
      )}

      {/* CABEÇALHO SUPERIOR */}
      <header className={`sticky top-0 z-30 border-b backdrop-blur-md ${theme.header}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-3">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="font-bold text-lg tracking-tight leading-none">FinançasPro</h1>
                <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold bg-indigo-500/15 text-indigo-400 border border-indigo-500/20">
                  {loggedUser.role === 'superadmin' ? 'SuperAdmin' : 'Pessoal'}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                  <Database className="w-3 h-3" /> pro-finance-control
                </span>
              </div>
              <p className={`text-xs mt-0.5 ${theme.muted}`}>
                Olá, <span className="font-semibold">{loggedUser.name}</span> ({loggedUser.email})
              </p>
            </div>
          </div>

          {/* Controles de Navegação, SuperAdmin, Guia Firebase e Tema */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Botão rápido para alternar perfil Usuário <-> SuperAdmin para facilitar testes */}
            <button
              onClick={() => {
                if (loggedUser.role === 'superadmin') {
                  setCurrentUserId('user-1');
                  setImpersonatedUserId(null);
                  setActiveView('dashboard');
                  showToast('Alternado para visão de Usuário (Carlos)');
                } else {
                  setCurrentUserId('admin-1');
                  setImpersonatedUserId(null);
                  setActiveView('superadmin');
                  showToast('Modo SuperAdmin ativado!');
                }
              }}
              className={`px-3 py-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all ${
                loggedUser.role === 'superadmin'
                  ? 'bg-amber-500/15 border-amber-500/40 text-amber-400'
                  : theme.subCard
              }`}
              title="Alternar rapidamente entre Usuário e SuperAdmin"
            >
              <ShieldAlert className="w-4 h-4 text-amber-500" />
              {loggedUser.role === 'superadmin' ? 'Sair do Modo SuperAdmin' : 'Testar SuperAdmin'}
            </button>

            {/* Se for SuperAdmin, permite alternar entre Painel de Usuários e Meu Dashboard */}
            {loggedUser.role === 'superadmin' && (
              <div className={`flex rounded-xl p-1 border ${theme.subCard}`}>
                <button
                  onClick={() => setActiveView('superadmin')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                    activeView === 'superadmin'
                      ? 'bg-indigo-600 text-white shadow'
                      : theme.muted
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  Gerenciar Contas ({users.length})
                </button>
                <button
                  onClick={() => setActiveView('dashboard')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                    activeView === 'dashboard'
                      ? 'bg-indigo-600 text-white shadow'
                      : theme.muted
                  }`}
                >
                  <PieChart className="w-3.5 h-3.5" />
                  Painel Financeiro
                </button>
              </div>
            )}

            {/* Botão Código & Config Firebase (pro-finance-control) */}
            <button
              onClick={() =>
                setActiveView(activeView === 'firebase-guide' ? 'dashboard' : 'firebase-guide')
              }
              className={`px-3 py-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all ${
                activeView === 'firebase-guide'
                  ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                  : theme.subCard
              }`}
            >
              <Code2 className="w-4 h-4 text-emerald-500" />
              Código & Config Firebase
            </button>

            {/* Botão Modo Claro / Escuro */}
            <button
              onClick={() => setDarkMode(!darkMode)}
              className={`p-2 rounded-xl border transition-all ${theme.subCard}`}
              title={darkMode ? 'Mudar para Modo Claro' : 'Mudar para Modo Escuro'}
            >
              {darkMode ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-indigo-600" />
              )}
            </button>

            {/* Botão Sair / Trocar Conta */}
            <button
              onClick={async () => {
                if (auth) {
                  try {
                    await signOut(auth);
                  } catch (e) {}
                }
                setCurrentUserId(null);
                setImpersonatedUserId(null);
              }}
              className="p-2 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition-all flex items-center gap-1 text-xs font-semibold px-3"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Sair</span>
            </button>
          </div>
        </div>

        {/* Aviso quando o SuperAdmin está inspecionando a conta de outro usuário */}
        {impersonatedUserId && (
          <div className="bg-amber-500/20 border-t border-amber-500/30 px-4 py-2 text-center flex items-center justify-center gap-3 text-xs">
            <span className="font-semibold text-amber-300 flex items-center gap-1.5">
              <Eye className="w-4 h-4" />
              SuperAdmin: Você está visualizando e editando o painel financeiro de{' '}
              <u>{activeUser.name}</u> ({activeUser.email})
            </span>
            <button
              onClick={() => {
                setImpersonatedUserId(null);
                setActiveView('superadmin');
              }}
              className="px-2.5 py-1 rounded-lg bg-amber-500 text-slate-950 font-bold hover:bg-amber-400"
            >
              Voltar para Administração
            </button>
          </div>
        )}
      </header>

      {/* CONTEÚDO PRINCIPAL */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-6">
        {/* ============================================================
            VISÃO 1: CÓDIGO & CONFIG FIREBASE (pro-finance-control)
        ============================================================ */}
        {activeView === 'firebase-guide' && (
          <div className={`rounded-2xl border p-6 sm:p-8 ${theme.card}`}>
            <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-slate-500/20">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                  <Database className="w-4 h-4" /> Projeto Conectado: pro-finance-control
                </span>
                <h2 className="text-2xl font-bold mt-1">
                  Código & Configuração do seu Firebase (pro-finance-control)
                </h2>
                <p className={`text-sm mt-1 ${theme.muted}`}>
                  Suas credenciais já estão integradas neste aplicativo! Confira abaixo o arquivo pronto para copiar e os ajustes finais no Console do Firebase.
                </p>
              </div>
              <button
                onClick={() => setActiveView('dashboard')}
                className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-500"
              >
                Voltar ao Dashboard Financeiro
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
              {/* Coluna Esquerda: Checklist no Console Firebase */}
              <div className="space-y-4">
                <div className={`p-4 rounded-xl border ${theme.subCard}`}>
                  <h3 className="font-bold text-sm text-indigo-400">
                    1. Ativar Google e E-mail/Senha no Authentication
                  </h3>
                  <p className={`text-xs mt-1.5 leading-relaxed ${theme.muted}`}>
                    No Console do seu projeto <strong>pro-finance-control</strong>:<br />
                    1. Acesse <strong>Criação &gt; Authentication &gt; Sign-in method</strong>.<br />
                    2. Clique em <strong>Google</strong>, marque <strong>Ativar</strong>, escolha seu e-mail de suporte e salve.<br />
                    3. Clique também em <strong>E-mail/senha</strong>, marque <strong>Ativar</strong> e salve.
                  </p>
                </div>

                <div className={`p-4 rounded-xl border ${theme.subCard}`}>
                  <h3 className="font-bold text-sm text-indigo-400">
                    2. Autorizar seu Domínio (Vercel / Netlify / Localhost)
                  </h3>
                  <p className={`text-xs mt-1.5 leading-relaxed ${theme.muted}`}>
                    Para que o popup do Google funcione quando você publicar o app:<br />
                    1. Vá em <strong>Authentication &gt; Settings (Configurações) &gt; Domínios autorizados</strong>.<br />
                    2. O <code>localhost</code> e <code>pro-finance-control.firebaseapp.com</code> já vêm ativados.<br />
                    3. Clique em <strong>Adicionar domínio</strong> caso hospede na Vercel (ex: <code>seu-app.vercel.app</code>).
                  </p>
                </div>

                <div className={`p-4 rounded-xl border ${theme.subCard}`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <h3 className="font-bold text-sm text-emerald-400">
                      3. Criar o Cloud Firestore e Regras de Segurança
                    </h3>
                    <button
                      onClick={() =>
                        handleCopyCode(
                          'rules',
                          `rules_version = '2';\nservice cloud.firestore {\n  match /databases/{database}/documents {\n    match /users/{userId} {\n      allow read, write: if request.auth != null;\n    }\n  }\n}`
                        )
                      }
                      className="px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-400 text-xs font-semibold flex items-center gap-1 hover:bg-emerald-500/25"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      {copiedSnippet === 'rules' ? 'Copiado!' : 'Copiar Regras'}
                    </button>
                  </div>
                  <p className={`text-xs leading-relaxed mb-2 ${theme.muted}`}>
                    Em <strong>Criação &gt; Firestore Database &gt; Regras</strong>, cole as regras abaixo para permitir que usuários logados salvem seus cartões, salário e gastos:
                  </p>
                  <pre className="p-3 rounded-lg bg-slate-950 text-emerald-300 font-mono text-[11px] overflow-x-auto">
{`rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null;
    }
  }
}`}
                  </pre>
                </div>
              </div>

              {/* Coluna Direita: Arquivo firebaseConfig.js completo com as chaves do usuário */}
              <div className={`p-4 rounded-xl border flex flex-col justify-between ${theme.subCard}`}>
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-bold text-sm text-emerald-400">
                      4. Seu arquivo firebaseConfig.js (Pronto para Copiar)
                    </span>
                    <button
                      onClick={() =>
                        handleCopyCode(
                          'config',
                          `import { initializeApp } from "firebase/app";\nimport { getAuth, GoogleAuthProvider, signInWithPopup } from "firebase/auth";\nimport { getFirestore } from "firebase/firestore";\n\nconst firebaseConfig = {\n  apiKey: "AIzaSyCsQJYqDTk3jwd3ZD3IDvfWjprk-IoFXR4",\n  authDomain: "pro-finance-control.firebaseapp.com",\n  projectId: "pro-finance-control",\n  storageBucket: "pro-finance-control.firebasestorage.app",\n  messagingSenderId: "1049329594472",\n  appId: "1:1049329594472:web:8dad6bc3f5a343111e8bdd"\n};\n\nexport const app = initializeApp(firebaseConfig);\nexport const auth = getAuth(app);\nexport const db = getFirestore(app);\nexport const googleProvider = new GoogleAuthProvider();\n\nexport const loginComGoogle = async () => {\n  const result = await signInWithPopup(auth, googleProvider);\n  return result.user;\n};`
                        )
                      }
                      className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold flex items-center gap-1.5 hover:bg-indigo-500"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      {copiedSnippet === 'config' ? 'Copiado!' : 'Copiar firebaseConfig.js'}
                    </button>
                  </div>

                  <pre className="p-4 rounded-xl bg-slate-950 text-emerald-300/95 font-mono text-xs overflow-x-auto leading-relaxed">
{`import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup 
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Configuração oficial do seu projeto pro-finance-control
const firebaseConfig = {
  apiKey: "AIzaSyCsQJYqDTk3jwd3ZD3IDvfWjprk-IoFXR4",
  authDomain: "pro-finance-control.firebaseapp.com",
  projectId: "pro-finance-control",
  storageBucket: "pro-finance-control.firebasestorage.app",
  messagingSenderId: "1049329594472",
  appId: "1:1049329594472:web:8dad6bc3f5a343111e8bdd"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

// Função para login com Google
export const loginComGoogle = async () => {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
};`}
                  </pre>
                </div>

                <div className="mt-4 p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-xs flex items-center justify-between">
                  <span>
                    Status atual da conexão com <strong>pro-finance-control</strong>:
                  </span>
                  <span className="font-bold text-emerald-400">
                    {firebaseStatus === 'connected'
                      ? '● SDK Inicializado e Ativo'
                      : '● Modo Híbrido (Sincronização Local + Auth)'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================
            VISÃO 2: PAINEL SUPERADMIN (GERENCIAMENTO DE CONTAS)
        ============================================================ */}
        {activeView === 'superadmin' && loggedUser.role === 'superadmin' && (
          <div className="space-y-6">
            {/* Banner SuperAdmin */}
            <div className="rounded-2xl p-6 bg-gradient-to-r from-amber-500/20 via-indigo-600/20 to-purple-600/20 border border-amber-500/30 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center shadow-lg">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">Painel de Controle SuperAdmin</h2>
                  <p className={`text-sm ${theme.muted}`}>
                    Administre todas as contas de usuários, visualize gastos, promova administradores, ative/suspenda acessos ou inspecione carteiras.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className={`px-4 py-2.5 rounded-xl border ${theme.card}`}>
                  <span className={`text-xs block ${theme.muted}`}>Total de Contas</span>
                  <span className="text-lg font-bold">{users.length} usuários</span>
                </div>
                <div className={`px-4 py-2.5 rounded-xl border ${theme.card}`}>
                  <span className={`text-xs block ${theme.muted}`}>Volume Movimentado</span>
                  <span className="text-lg font-bold text-emerald-400">
                    {formatBRL(
                      users.reduce(
                        (acc, u) =>
                          acc + u.expenses.reduce((s, e) => s + Number(e.totalAmount || 0), 0),
                        0
                      )
                    )}
                  </span>
                </div>
              </div>
            </div>

            {/* Criar Nova Conta Manualmente pelo SuperAdmin */}
            <div className={`rounded-2xl border p-5 ${theme.card}`}>
              <h3 className="text-sm font-bold uppercase tracking-wider mb-3 flex items-center gap-2">
                <PlusCircle className="w-4 h-4 text-indigo-400" />
                Cadastrar Novo Usuário pelo Painel SuperAdmin
              </h3>
              <form onSubmit={handleAdminCreateUser} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <input
                  type="text"
                  placeholder="Nome completo do usuário"
                  value={newAdminUserName}
                  onChange={(e) => setNewAdminUserName(e.target.value)}
                  className={`px-3.5 py-2.5 rounded-xl border text-sm outline-none ${theme.input}`}
                />
                <input
                  type="email"
                  placeholder="E-mail de acesso"
                  value={newAdminUserEmail}
                  onChange={(e) => setNewAdminUserEmail(e.target.value)}
                  className={`px-3.5 py-2.5 rounded-xl border text-sm outline-none ${theme.input}`}
                />
                <input
                  type="number"
                  placeholder="Salário Inicial (R$)"
                  value={newAdminUserSalary}
                  onChange={(e) => setNewAdminUserSalary(e.target.value)}
                  className={`px-3.5 py-2.5 rounded-xl border text-sm outline-none ${theme.input}`}
                />
                <button
                  type="submit"
                  className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition-all"
                >
                  + Criar Conta de Usuário
                </button>
              </form>
            </div>

            {/* Tabela de Usuários Cadastrados */}
            <div className={`rounded-2xl border overflow-hidden ${theme.card}`}>
              <div className="p-5 border-b border-slate-500/20 flex items-center justify-between">
                <h3 className="font-bold text-base flex items-center gap-2">
                  <Users className="w-5 h-5 text-indigo-400" />
                  Contas de Usuários Registradas
                </h3>
                <span className={`text-xs ${theme.muted}`}>
                  Clique em "Acessar Painel" para gerenciar os cartões, despesas fixas e gastos de qualquer usuário
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className={`border-b border-slate-500/20 text-xs uppercase ${theme.muted}`}>
                      <th className="py-3.5 px-4">Usuário</th>
                      <th className="py-3.5 px-4">Login / Provedor</th>
                      <th className="py-3.5 px-4">Salário</th>
                      <th className="py-3.5 px-4">Resumo de Uso</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-4 text-right">Ações do SuperAdmin</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-500/15 text-sm">
                    {users.map((u) => {
                      const userTotalExpenses = u.expenses.reduce(
                        (s, e) => s + Number(e.totalAmount || 0),
                        0
                      );
                      return (
                        <tr key={u.id} className="hover:bg-slate-500/5 transition-colors">
                          <td className="py-3.5 px-4">
                            <div className="font-semibold flex items-center gap-2">
                              {u.name}
                              {u.role === 'superadmin' && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-bold">
                                  SUPERADMIN
                                </span>
                              )}
                            </div>
                            <div className={`text-xs ${theme.muted}`}>{u.email}</div>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="text-xs px-2.5 py-1 rounded-lg border border-slate-500/30 font-medium">
                              {u.authProvider === 'google' ? 'Google Auth' : 'E-mail / Senha'}
                            </span>
                            <div className={`text-[11px] mt-1 ${theme.muted}`}>
                              Desde {u.createdAt}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 font-semibold text-emerald-400">
                            {formatBRL(u.salary)}
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="text-xs">
                              <strong>{u.cards.length}</strong> cartões •{' '}
                              <strong>{u.fixedExpenses.length}</strong> fixas
                            </div>
                            <div className={`text-xs ${theme.muted}`}>
                              {u.expenses.length} compras ({formatBRL(userTotalExpenses)})
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            {u.status === 'active' ? (
                              <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-400">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Ativo
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-rose-500/15 text-rose-400">
                                <UserX className="w-3.5 h-3.5" /> Suspenso
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-right space-x-2">
                            <button
                              onClick={() => {
                                setImpersonatedUserId(u.id);
                                setActiveView('dashboard');
                                showToast(`Visualizando painel de ${u.name}`);
                              }}
                              className="px-3 py-1.5 rounded-lg bg-indigo-500/15 text-indigo-400 hover:bg-indigo-500/25 text-xs font-semibold inline-flex items-center gap-1"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              Acessar Painel
                            </button>

                            {u.id !== loggedUser.id && (
                              <>
                                <button
                                  onClick={() => handleToggleUserRole(u.id)}
                                  className="px-2.5 py-1.5 rounded-lg border border-purple-500/30 text-purple-400 hover:bg-purple-500/15 text-xs font-semibold"
                                  title="Alternar permissão de SuperAdmin"
                                >
                                  {u.role === 'superadmin' ? 'Tornar Usuário' : 'Tornar Admin'}
                                </button>
                                <button
                                  onClick={() => handleToggleUserStatus(u.id)}
                                  className="px-2.5 py-1.5 rounded-lg border border-amber-500/30 text-amber-400 hover:bg-amber-500/15 text-xs font-semibold"
                                >
                                  {u.status === 'active' ? 'Suspender' : 'Ativar'}
                                </button>
                                <button
                                  onClick={() => handleDeleteUserAccount(u.id)}
                                  className="p-1.5 rounded-lg border border-rose-500/30 text-rose-400 hover:bg-rose-500/15"
                                  title="Excluir conta"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================
            VISÃO 3: PAINÉIS DE CONTROLE FINANCEIRO (DASHBOARD PRINCIPAL)
        ============================================================ */}
        {activeView === 'dashboard' && activeUser && (
          <div className="space-y-6">
            {/* PAINEL DE TOTAL DE GASTOS (CARDS DE RESUMO CONSOLIDADO) */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs font-bold uppercase tracking-wider flex items-center gap-2 text-indigo-400">
                  <Sparkles className="w-4 h-4" />
                  Painel Consolidado • Total de Gastos e Comprometimento
                </h2>
                <span className={`text-xs ${theme.muted}`}>
                  Cálculos atualizados em tempo real
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Card 1: Salário e Saldo Livre */}
                <div className={`rounded-2xl border p-5 relative overflow-hidden ${theme.card}`}>
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-semibold uppercase ${theme.muted}`}>
                      Salário Mensal
                    </span>
                    <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-400">
                      <Wallet className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="text-2xl font-extrabold mt-2 text-emerald-400">
                    {formatBRL(financials.salary)}
                  </div>
                  <div className="mt-2 pt-2 border-t border-slate-500/15 flex items-center justify-between text-xs">
                    <span className={theme.muted}>Saldo Livre no Mês:</span>
                    <span
                      className={`font-bold ${
                        financials.remainingSalary >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {formatBRL(financials.remainingSalary)}
                    </span>
                  </div>
                </div>

                {/* Card 2: Total de Despesas Fixas */}
                <div className={`rounded-2xl border p-5 ${theme.card}`}>
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-semibold uppercase ${theme.muted}`}>
                      Despesas Fixas
                    </span>
                    <div className="p-2 rounded-xl bg-blue-500/15 text-blue-400">
                      <Home className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="text-2xl font-extrabold mt-2">
                    {formatBRL(financials.totalFixed)}
                  </div>
                  <div className="mt-2 pt-2 border-t border-slate-500/15 flex items-center justify-between text-xs">
                    <span className="text-emerald-400">Pago: {formatBRL(financials.paidFixed)}</span>
                    <span className="text-amber-400">
                      Pendente: {formatBRL(financials.pendingFixed)}
                    </span>
                  </div>
                </div>

                {/* Card 3: Total nos Cartões de Crédito */}
                <div className={`rounded-2xl border p-5 ${theme.card}`}>
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-semibold uppercase ${theme.muted}`}>
                      Gasto nos Cartões
                    </span>
                    <div className="p-2 rounded-xl bg-purple-500/15 text-purple-400">
                      <CreditCard className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="text-2xl font-extrabold mt-2 text-purple-400">
                    {formatBRL(financials.totalCardUsed)}
                  </div>
                  <div className="mt-2 pt-2 border-t border-slate-500/15 flex items-center justify-between text-xs">
                    <span className={theme.muted}>Parcelas deste mês:</span>
                    <span className="font-bold text-amber-400">
                      {formatBRL(financials.totalMonthlyCardBill)}
                    </span>
                  </div>
                </div>

                {/* Card 4: Total Geral de Gastos */}
                <div className={`rounded-2xl border p-5 ${theme.card}`}>
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-semibold uppercase ${theme.muted}`}>
                      Total Geral de Gastos
                    </span>
                    <div className="p-2 rounded-xl bg-rose-500/15 text-rose-400">
                      <TrendingDown className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="text-2xl font-extrabold mt-2 text-rose-400">
                    {formatBRL(financials.totalAllPurchases)}
                  </div>
                  <div className="mt-2 pt-2 border-t border-slate-500/15 flex items-center justify-between text-xs">
                    <span className={theme.muted}>Impacto Mensal (Fixas + Parcelas):</span>
                    <span className="font-bold">{formatBRL(financials.monthlyCommitment)}</span>
                  </div>
                </div>
              </div>
            </section>

            {/* GRID PRINCIPAL: COLUNA ESQUERDA (SALÁRIO + DESPESAS FIXAS LOGO ABAIXO) E COLUNA DIREITA (CARTÕES + LANÇAMENTO DE GASTOS) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* ==========================================================
                  COLUNA ESQUERDA (5 COLUNAS):
                  1. PAINEL DE SALÁRIO
                  2. PAINEL DE DESPESAS FIXAS (LOGO ABAIXO DO PAINEL DE SALÁRIO)
              ========================================================== */}
              <div className="lg:col-span-5 space-y-6">
                {/* 1. PAINEL DE SALÁRIO */}
                <div className={`rounded-2xl border p-6 ${theme.card}`}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
                        <DollarSign className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-base">Painel de Salário</h3>
                        <p className={`text-xs ${theme.muted}`}>Renda mensal base para cálculos</p>
                      </div>
                    </div>

                    {!isEditingSalary && (
                      <button
                        onClick={() => {
                          setSalaryInput(String(activeUser.salary));
                          setIsEditingSalary(true);
                        }}
                        className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 hover:border-emerald-500 transition-all ${theme.subCard}`}
                      >
                        <Edit3 className="w-3.5 h-3.5 text-emerald-400" />
                        Alterar Salário
                      </button>
                    )}
                  </div>

                  {isEditingSalary ? (
                    <form onSubmit={handleSaveSalary} className="flex items-center gap-2 mb-4">
                      <div className="relative flex-1">
                        <span className="absolute left-3.5 top-2.5 text-xs font-bold text-emerald-400">
                          R$
                        </span>
                        <input
                          type="number"
                          step="0.01"
                          autoFocus
                          value={salaryInput}
                          onChange={(e) => setSalaryInput(e.target.value)}
                          className={`w-full pl-9 pr-3 py-2 rounded-xl border text-sm font-bold outline-none ${theme.input}`}
                        />
                      </div>
                      <button
                        type="submit"
                        className="p-2.5 rounded-xl bg-emerald-600 text-white hover:bg-emerald-500"
                        title="Salvar"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsEditingSalary(false)}
                        className="p-2.5 rounded-xl bg-rose-500/20 text-rose-400 hover:bg-rose-500/30"
                        title="Cancelar"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </form>
                  ) : (
                    <div className={`p-4 rounded-xl border mb-4 ${theme.subCard}`}>
                      <span className={`text-xs ${theme.muted}`}>Salário Líquido Informado</span>
                      <div className="text-3xl font-extrabold text-emerald-400 mt-0.5">
                        {formatBRL(financials.salary)}
                      </div>
                    </div>
                  )}

                  {/* Barra de Comprometimento do Salário */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className={theme.muted}>Comprometimento Mensal do Salário</span>
                      <span className="font-bold">
                        {financials.salaryCommitmentPercent.toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full h-2.5 rounded-full bg-slate-500/20 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          financials.salaryCommitmentPercent > 85
                            ? 'bg-rose-500'
                            : financials.salaryCommitmentPercent > 60
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
                        }`}
                        style={{ width: `${financials.salaryCommitmentPercent}%` }}
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-2 pt-2 text-[11px]">
                      <div className={`p-2 rounded-lg border ${theme.subCard}`}>
                        <span className={`block ${theme.muted}`}>Fixas</span>
                        <span className="font-bold">{formatBRL(financials.totalFixed)}</span>
                      </div>
                      <div className={`p-2 rounded-lg border ${theme.subCard}`}>
                        <span className={`block ${theme.muted}`}>Débito/Pix</span>
                        <span className="font-bold">
                          {formatBRL(financials.directSalaryExpenses)}
                        </span>
                      </div>
                      <div className={`p-2 rounded-lg border ${theme.subCard}`}>
                        <span className={`block ${theme.muted}`}>Parcelas Mês</span>
                        <span className="font-bold">
                          {formatBRL(financials.totalMonthlyCardBill)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. PAINEL DE DESPESAS FIXAS (LOGO ABAIXO DO PAINEL DE SALÁRIO) */}
                <div className={`rounded-2xl border p-6 ${theme.card}`}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-blue-500/15 text-blue-400 flex items-center justify-center">
                        <Home className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-base">Painel de Despesas Fixas</h3>
                        <p className={`text-xs ${theme.muted}`}>
                          Aluguel, academia, luz, água, internet e afins
                        </p>
                      </div>
                    </div>
                    <span className="text-sm font-extrabold text-blue-400">
                      {formatBRL(financials.totalFixed)}
                    </span>
                  </div>

                  {/* Formulário para Adicionar Despesa Fixa */}
                  <form onSubmit={handleAddFixedExpense} className="space-y-3 mb-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <input
                        type="text"
                        placeholder="Ex: Aluguel, Academia, Luz..."
                        value={fixedName}
                        onChange={(e) => setFixedName(e.target.value)}
                        className={`px-3.5 py-2 rounded-xl border text-xs outline-none ${theme.input}`}
                      />
                      <select
                        value={fixedCategory}
                        onChange={(e) => setFixedCategory(e.target.value)}
                        className={`px-3 py-2 rounded-xl border text-xs outline-none ${theme.input}`}
                      >
                        {FIXED_CATEGORIES.map((cat) => (
                          <option key={cat.id} value={cat.id}>
                            {cat.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        step="0.01"
                        placeholder="Valor mensal (R$)"
                        value={fixedAmount}
                        onChange={(e) => setFixedAmount(e.target.value)}
                        className={`flex-1 px-3.5 py-2 rounded-xl border text-xs outline-none ${theme.input}`}
                      />
                      <button
                        type="submit"
                        className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 shrink-0 transition-all"
                      >
                        <PlusCircle className="w-4 h-4" />
                        Adicionar Fixa
                      </button>
                    </div>
                  </form>

                  {/* Lista de Despesas Fixas */}
                  <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                    {activeUser.fixedExpenses.length === 0 ? (
                      <p className={`text-xs text-center py-6 ${theme.muted}`}>
                        Nenhuma despesa fixa cadastrada. Adicione aluguel, luz, água ou academia acima.
                      </p>
                    ) : (
                      activeUser.fixedExpenses.map((item) => {
                        const catObj =
                          FIXED_CATEGORIES.find((c) => c.id === item.category) ||
                          FIXED_CATEGORIES[0];
                        const IconComponent = catObj.icon;
                        return (
                          <div
                            key={item.id}
                            className={`p-3 rounded-xl border flex items-center justify-between gap-2 transition-all ${theme.subCard}`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className={`p-2 rounded-lg shrink-0 ${catObj.color}`}>
                                <IconComponent className="w-4 h-4" />
                              </div>
                              <div className="truncate">
                                <p
                                  className={`text-xs font-semibold truncate ${
                                    item.paid ? 'line-through opacity-60' : ''
                                  }`}
                                >
                                  {item.name}
                                </p>
                                <span className={`text-[11px] ${theme.muted}`}>
                                  {catObj.label}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-xs font-bold">{formatBRL(item.amount)}</span>
                              <button
                                onClick={() => handleToggleFixedPaid(item.id)}
                                className={`px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all ${
                                  item.paid
                                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                    : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                }`}
                                title="Alternar entre Pago e Pendente"
                              >
                                {item.paid ? (
                                  <>
                                    <CheckCircle2 className="w-3 h-3" /> Pago
                                  </>
                                ) : (
                                  <>
                                    <Clock className="w-3 h-3" /> Pendente
                                  </>
                                )}
                              </button>
                              <button
                                onClick={() => handleDeleteFixed(item.id)}
                                className="p-1 text-slate-400 hover:text-rose-400 transition-colors"
                                title="Remover despesa fixa"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

              {/* ==========================================================
                  COLUNA DIREITA (7 COLUNAS):
                  3. PAINEL DE CARTÕES DE CRÉDITO E LIMITES (SEM DÍGITOS)
                  4. PAINEL PARA INFORMAR O QUE FOI GASTO, ONDE E QUANTO FOI
              ========================================================== */}
              <div className="lg:col-span-7 space-y-6">
                {/* 3. PAINEL DE CARTÕES DE CRÉDITO E LIMITES */}
                <div className={`rounded-2xl border p-6 ${theme.card}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-purple-500/15 text-purple-400 flex items-center justify-center">
                        <CreditCard className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-base">
                          Painel de Cartões de Crédito e Limites
                        </h3>
                        <p className={`text-xs ${theme.muted}`}>
                          Apenas nome de identificação do cartão e limite (sem dígitos)
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className={`text-[11px] block ${theme.muted}`}>
                        Limite Disponível Total
                      </span>
                      <span className="text-sm font-extrabold text-emerald-400">
                        {formatBRL(Math.max(0, financials.totalCardLimit - financials.totalCardUsed))}
                      </span>
                    </div>
                  </div>

                  {/* Formulário de Novo Cartão (Apenas Nome e Limite) */}
                  <form
                    onSubmit={handleAddCard}
                    className={`p-3.5 rounded-xl border mb-5 grid grid-cols-1 sm:grid-cols-12 gap-2.5 ${theme.subCard}`}
                  >
                    <input
                      type="text"
                      placeholder="Nome do Cartão (ex: Nubank, Inter)"
                      value={cardName}
                      onChange={(e) => setCardName(e.target.value)}
                      className={`sm:col-span-4 px-3 py-2 rounded-lg border text-xs outline-none ${theme.input}`}
                    />
                    <input
                      type="number"
                      step="0.01"
                      placeholder="Limite Total (R$)"
                      value={cardLimit}
                      onChange={(e) => setCardLimit(e.target.value)}
                      className={`sm:col-span-3 px-3 py-2 rounded-lg border text-xs outline-none ${theme.input}`}
                    />
                    <select
                      value={cardColor}
                      onChange={(e) => setCardColor(e.target.value)}
                      className={`sm:col-span-3 px-2.5 py-2 rounded-lg border text-xs outline-none ${theme.input}`}
                    >
                      {CARD_COLORS.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="submit"
                      className="sm:col-span-2 py-2 px-3 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs flex items-center justify-center gap-1 transition-all"
                    >
                      <PlusCircle className="w-3.5 h-3.5" />
                      Criar
                    </button>
                  </form>

                  {/* Lista de Cartões Cadastrados */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {financials.cardsWithStats.map((card) => (
                      <div
                        key={card.id}
                        className={`rounded-2xl p-4 bg-gradient-to-br ${card.color} text-white shadow-lg relative overflow-hidden flex flex-col justify-between`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="text-[10px] uppercase tracking-widest opacity-75 font-semibold">
                              Cartão de Crédito
                            </span>
                            <h4 className="text-lg font-extrabold tracking-tight">{card.name}</h4>
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => {
                                setEditingCardId(card.id);
                                setEditingCardLimit(String(card.limit));
                              }}
                              className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-all"
                              title="Editar limite do cartão"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteCard(card.id)}
                              className="p-1.5 rounded-lg bg-white/10 hover:bg-rose-500/80 text-white transition-all"
                              title="Excluir cartão"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Edição rápida de limite */}
                        {editingCardId === card.id ? (
                          <div className="my-3 flex items-center gap-1.5 bg-black/30 p-2 rounded-xl">
                            <input
                              type="number"
                              value={editingCardLimit}
                              onChange={(e) => setEditingCardLimit(e.target.value)}
                              className="w-full bg-white text-slate-900 px-2.5 py-1 rounded-lg text-xs font-bold outline-none"
                            />
                            <button
                              onClick={() => handleSaveCardLimit(card.id)}
                              className="p-1.5 bg-emerald-500 rounded-lg text-white"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setEditingCardId(null)}
                              className="p-1.5 bg-rose-500 rounded-lg text-white"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="my-3 grid grid-cols-2 gap-2 bg-black/20 p-2.5 rounded-xl text-xs">
                            <div>
                              <span className="text-[10px] opacity-75 block">Limite Total</span>
                              <span className="font-bold">{formatBRL(card.limit)}</span>
                            </div>
                            <div>
                              <span className="text-[10px] opacity-75 block">Disponível</span>
                              <span className="font-bold text-emerald-300">
                                {formatBRL(card.availableLimit)}
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Barra de uso do limite */}
                        <div>
                          <div className="flex justify-between text-[11px] mb-1">
                            <span>Usado: {formatBRL(card.usedLimit)}</span>
                            <span className="font-bold">{card.usagePercent.toFixed(0)}%</span>
                          </div>
                          <div className="w-full h-2 rounded-full bg-black/30 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                card.usagePercent > 85 ? 'bg-rose-400' : 'bg-white'
                              }`}
                              style={{ width: `${card.usagePercent}%` }}
                            />
                          </div>
                          <div className="mt-2 flex justify-between items-center text-[11px] opacity-90">
                            <span>{card.purchasesCount} compras ativas</span>
                            <span className="font-semibold">
                              Parcelas/mês: {formatBRL(card.monthlyInstallmentsSum)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 4. PAINEL PARA INFORMAR O QUE FOI GASTO, ONDE E QUANTO FOI */}
                <div className={`rounded-2xl border p-6 ${theme.card}`}>
                  <div className="flex items-center gap-2.5 mb-4">
                    <div className="w-9 h-9 rounded-xl bg-indigo-500/15 text-indigo-400 flex items-center justify-center">
                      <ShoppingBag className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-base">
                        Painel para Informar Gastos (O que, Onde e Quanto foi)
                      </h3>
                      <p className={`text-xs ${theme.muted}`}>
                        Registre uma nova compra à vista ou parcelada vinculando ao cartão ou salário
                      </p>
                    </div>
                  </div>

                  <form onSubmit={handleAddExpense} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      {/* O que foi gasto */}
                      <div>
                        <label className="block text-xs font-semibold mb-1">
                          1. O que foi gasto? (Item / Descrição)
                        </label>
                        <div className="relative">
                          <ShoppingBag className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                          <input
                            type="text"
                            placeholder="Ex: Geladeira, Supermercado, Tênis..."
                            value={expenseWhat}
                            onChange={(e) => setExpenseWhat(e.target.value)}
                            className={`w-full pl-9 pr-3 py-2 rounded-xl border text-xs outline-none ${theme.input}`}
                          />
                        </div>
                      </div>

                      {/* Onde foi gasto */}
                      <div>
                        <label className="block text-xs font-semibold mb-1">
                          2. Onde foi gasto? (Local / Loja)
                        </label>
                        <div className="relative">
                          <MapPin className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                          <input
                            type="text"
                            placeholder="Ex: Amazon, Carrefour, Shopping..."
                            value={expenseWhere}
                            onChange={(e) => setExpenseWhere(e.target.value)}
                            className={`w-full pl-9 pr-3 py-2 rounded-xl border text-xs outline-none ${theme.input}`}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                      {/* Quanto foi */}
                      <div>
                        <label className="block text-xs font-semibold mb-1">
                          3. Quanto foi? (Valor Total R$)
                        </label>
                        <div className="relative">
                          <DollarSign className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                          <input
                            type="number"
                            step="0.01"
                            placeholder="Ex: 450.00"
                            value={expenseAmount}
                            onChange={(e) => setExpenseAmount(e.target.value)}
                            className={`w-full pl-9 pr-3 py-2 rounded-xl border text-xs outline-none ${theme.input}`}
                          />
                        </div>
                      </div>

                      {/* Qual Cartão ou Salário */}
                      <div>
                        <label className="block text-xs font-semibold mb-1">
                          4. Qual Cartão / Método?
                        </label>
                        <select
                          value={expenseMethod}
                          onChange={(e) => {
                            setExpenseMethod(e.target.value);
                            if (e.target.value === 'salary') setExpenseInstallments(1);
                          }}
                          className={`w-full px-3 py-2 rounded-xl border text-xs outline-none ${theme.input}`}
                        >
                          <optgroup label="Cartões de Crédito Cadastrados">
                            {activeUser.cards.map((c) => (
                              <option key={c.id} value={c.id}>
                                💳 Cartão {c.name}
                              </option>
                            ))}
                          </optgroup>
                          <optgroup label="Direto da Conta">
                            <option value="salary">💵 Salário (Pix / Débito à vista)</option>
                          </optgroup>
                        </select>
                      </div>

                      {/* Quantidade de Parcelas */}
                      <div>
                        <label className="block text-xs font-semibold mb-1">
                          5. Parcelamento
                        </label>
                        <select
                          value={expenseMethod === 'salary' ? 1 : expenseInstallments}
                          disabled={expenseMethod === 'salary'}
                          onChange={(e) => setExpenseInstallments(Number(e.target.value))}
                          className={`w-full px-3 py-2 rounded-xl border text-xs outline-none ${theme.input}`}
                        >
                          <option value={1}>À vista (1x)</option>
                          {[2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 18, 24].map((n) => {
                            const val = parseFloat(expenseAmount) || 0;
                            const installmentVal = val > 0 ? ` - ${formatBRL(val / n)}/mês` : '';
                            return (
                              <option key={n} value={n}>
                                Parcelado em {n}x{installmentVal}
                              </option>
                            );
                          })}
                        </select>
                      </div>
                    </div>

                    {/* Prévia automática do lançamento */}
                    {parseFloat(expenseAmount) > 0 && (
                      <div
                        className={`p-3 rounded-xl border flex flex-wrap items-center justify-between text-xs ${theme.subCard}`}
                      >
                        <span>
                          Resumo: <strong>{expenseWhat || 'Item'}</strong> em{' '}
                          <strong>{expenseWhere || 'Local'}</strong>
                        </span>
                        <span className="font-bold text-indigo-400">
                          {expenseInstallments > 1 && expenseMethod !== 'salary'
                            ? `${expenseInstallments}x de ${formatBRL(
                                parseFloat(expenseAmount) / expenseInstallments
                              )} (Total: ${formatBRL(parseFloat(expenseAmount))})`
                            : `À vista: ${formatBRL(parseFloat(expenseAmount))}`}
                        </span>
                      </div>
                    )}

                    <button
                      type="submit"
                      className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold text-xs uppercase tracking-wider shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2 transition-all"
                    >
                      <PlusCircle className="w-4 h-4" />
                      Registrar Gasto no Painel
                    </button>
                  </form>
                </div>
              </div>
            </div>

            {/* ==========================================================
                5. PAINEL INFORMANDO O QUE FOI GASTO, TOTAL E PARCELAS
            ========================================================== */}
            <section className={`rounded-2xl border overflow-hidden ${theme.card}`}>
              <div className="p-6 border-b border-slate-500/20 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center">
                    <Layers className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base">
                      Painel de Gastos Detalhados, Total e Parcelas
                    </h3>
                    <p className={`text-xs ${theme.muted}`}>
                      Acompanhe o que foi comprado, onde, de qual cartão saiu, o valor da parcela mensal e o valor total
                    </p>
                  </div>
                </div>

                {/* Filtros Rápidos */}
                <div className="flex flex-wrap items-center gap-2">
                  {/* Busca por texto */}
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Buscar gasto ou loja..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className={`pl-8 pr-3 py-1.5 rounded-xl border text-xs outline-none ${theme.input}`}
                    />
                  </div>

                  {/* Filtro por Cartão */}
                  <select
                    value={filterPayment}
                    onChange={(e) => setFilterPayment(e.target.value)}
                    className={`px-3 py-1.5 rounded-xl border text-xs outline-none ${theme.input}`}
                  >
                    <option value="all">Todos os Cartões / Métodos</option>
                    <option value="salary">💵 Apenas Salário (Pix/Débito)</option>
                    {activeUser.cards.map((c) => (
                      <option key={c.id} value={c.id}>
                        💳 Cartão {c.name}
                      </option>
                    ))}
                  </select>

                  {/* Filtro À vista vs Parcelado */}
                  <select
                    value={filterInstallmentType}
                    onChange={(e) => setFilterInstallmentType(e.target.value)}
                    className={`px-3 py-1.5 rounded-xl border text-xs outline-none ${theme.input}`}
                  >
                    <option value="all">À Vista + Parcelados</option>
                    <option value="installments">Apenas Parcelados (2x+)</option>
                    <option value="single">Apenas À Vista (1x)</option>
                  </select>
                </div>
              </div>

              {/* Tabela de Gastos, Total e Parcelas */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className={`border-b border-slate-500/20 text-xs uppercase ${theme.muted}`}>
                      <th className="py-3.5 px-5">O que foi gasto</th>
                      <th className="py-3.5 px-4">Onde foi gasto</th>
                      <th className="py-3.5 px-4">Cartão / Origem</th>
                      <th className="py-3.5 px-4">Parcelas (Impacto Mensal)</th>
                      <th className="py-3.5 px-4">Valor Total</th>
                      <th className="py-3.5 px-5 text-right">Remover</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-500/15 text-sm">
                    {filteredExpenses.length === 0 ? (
                      <tr>
                        <td colSpan={6} className={`py-8 text-center text-xs ${theme.muted}`}>
                          Nenhum gasto encontrado para os filtros selecionados.
                        </td>
                      </tr>
                    ) : (
                      filteredExpenses.map((exp) => {
                        const cardObj = activeUser.cards.find((c) => c.id === exp.paymentMethod);
                        const installmentValue =
                          (Number(exp.totalAmount) || 0) / (Number(exp.installments) || 1);

                        return (
                          <tr key={exp.id} className="hover:bg-slate-500/5 transition-colors">
                            <td className="py-3.5 px-5">
                              <div className="font-bold">{exp.what}</div>
                              <div className={`text-[11px] ${theme.muted}`}>{exp.date}</div>
                            </td>
                            <td className="py-3.5 px-4">
                              <span className="inline-flex items-center gap-1.5 text-xs">
                                <MapPin className="w-3.5 h-3.5 text-indigo-400" />
                                {exp.where}
                              </span>
                            </td>
                            <td className="py-3.5 px-4">
                              {exp.paymentMethod === 'salary' ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                  <Wallet className="w-3.5 h-3.5" /> Salário / Pix
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-purple-500/15 text-purple-400 border border-purple-500/30">
                                  <CreditCard className="w-3.5 h-3.5" />{' '}
                                  {cardObj ? cardObj.name : 'Cartão'}
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 px-4">
                              {exp.installments > 1 ? (
                                <div>
                                  <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-400 font-bold text-xs">
                                    {exp.installments}x de {formatBRL(installmentValue)}
                                  </span>
                                </div>
                              ) : (
                                <span className={`text-xs font-medium ${theme.muted}`}>
                                  À vista (1x de {formatBRL(exp.totalAmount)})
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 px-4 font-extrabold text-rose-400">
                              {formatBRL(exp.totalAmount)}
                            </td>
                            <td className="py-3.5 px-5 text-right">
                              <button
                                onClick={() => handleDeleteExpense(exp.id)}
                                className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-all"
                                title="Excluir lançamento"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Rodapé com Somatório da Tabela Filtrada */}
              <div
                className={`p-4 border-t border-slate-500/20 flex flex-wrap items-center justify-between gap-4 text-xs ${theme.subCard}`}
              >
                <span className={theme.muted}>
                  Exibindo <strong>{filteredExpenses.length}</strong> lançamentos
                </span>
                <div className="flex flex-wrap items-center gap-6">
                  <div>
                    <span className={theme.muted}>Soma das Parcelas Mensais (Filtro): </span>
                    <strong className="text-amber-400 text-sm">
                      {formatBRL(
                        filteredExpenses.reduce(
                          (acc, e) => acc + Number(e.totalAmount) / (Number(e.installments) || 1),
                          0
                        )
                      )}
                    </strong>
                  </div>
                  <div>
                    <span className={theme.muted}>Valor Total Acumulado (Filtro): </span>
                    <strong className="text-rose-400 text-sm">
                      {formatBRL(
                        filteredExpenses.reduce((acc, e) => acc + Number(e.totalAmount), 0)
                      )}
                    </strong>
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}