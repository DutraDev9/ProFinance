import React, { useState, useEffect } from "react";
import {
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
} from "firebase/auth";
import {
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  deleteDoc,
} from "firebase/firestore";
import { auth, googleProvider, db } from "./services/firebaseConfig";
import {
  Wallet,
  CreditCard,
  TrendingDown,
  Plus,
  Trash2,
  Sun,
  Moon,
  ShieldAlert,
  LogOut,
  Home,
  ShoppingBag,
  Layers,
  Users,
  Pencil,
  Check,
  X,
} from "lucide-react";

const SUPERADMIN_EMAILS = ["admin@financas.com"];
const SESSION_DURATION_MS = 10 * 60 * 1000; // 10 minutos em milissegundos
const SESSION_STORAGE_KEY = "pfc_login_timestamp";

const formatBRL = (value) => {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
};

export default function App() {
  const [darkMode, setDarkMode] = useState(true);
  const [user, setUser] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  // Estados de Autenticação
  const [isRegistering, setIsRegistering] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [emailInput, setEmailInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [authError, setAuthError] = useState("");

  // Aba ativa (dashboard ou superadmin)
  const [activeView, setActiveView] = useState("dashboard");

  // Dados Financeiros do Usuário (Tudo começa zerado)
  const [salary, setSalary] = useState(0);
  const [fixedExpenses, setFixedExpenses] = useState([]);
  const [cards, setCards] = useState([]);
  const [expenses, setExpenses] = useState([]);

  // Edição do Salário no próprio painel
  const [isEditingSalary, setIsEditingSalary] = useState(false);
  const [salaryInput, setSalaryInput] = useState("");

  // Inputs e Edição de Despesas Fixas
  const [fixedName, setFixedName] = useState("");
  const [fixedAmount, setFixedAmount] = useState("");
  const [editingFixedId, setEditingFixedId] = useState(null);
  const [editFixedName, setEditFixedName] = useState("");
  const [editFixedAmount, setEditFixedAmount] = useState("");

  // Inputs e Edição de Cartões de Crédito
  const [cardName, setCardName] = useState("");
  const [cardLimit, setCardLimit] = useState("");
  const [editingCardId, setEditingCardId] = useState(null);
  const [editCardName, setEditCardName] = useState("");
  const [editCardLimit, setEditCardLimit] = useState("");

  // Inputs e Edição de Gastos (Começa tudo vazio/zerado, sem forçar 1)
  const [expWhat, setExpWhat] = useState("");
  const [expWhere, setExpWhere] = useState("");
  const [expAmount, setExpAmount] = useState("");
  const [expInstallments, setExpInstallments] = useState("");
  const [expPaymentSource, setExpPaymentSource] = useState("salary");

  const [editingExpId, setEditingExpId] = useState(null);
  const [editExpWhat, setEditExpWhat] = useState("");
  const [editExpWhere, setEditExpWhere] = useState("");
  const [editExpAmount, setEditExpAmount] = useState("");
  const [editExpInstallments, setEditExpInstallments] = useState("");
  const [editExpPaymentSource, setEditExpPaymentSource] = useState("salary");

  // Lista de usuários para o SuperAdmin
  const [allUsers, setAllUsers] = useState([]);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [darkMode]);

  // Controle de Sessão: Nunca começa logado sem um login válido nos últimos 10 minutos
  useEffect(() => {
    let logoutTimer = null;

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      const loginTimestamp = localStorage.getItem(SESSION_STORAGE_KEY);
      const now = Date.now();

      if (currentUser && loginTimestamp) {
        const elapsed = now - Number(loginTimestamp);

        if (elapsed < SESSION_DURATION_MS) {
          await loadOrCreateUserData(currentUser);
          const remainingTime = SESSION_DURATION_MS - elapsed;

          if (logoutTimer) clearTimeout(logoutTimer);
          logoutTimer = setTimeout(async () => {
            localStorage.removeItem(SESSION_STORAGE_KEY);
            await signOut(auth);
            setUser(null);
          }, remainingTime);
        } else {
          // Sessão de 10 minutos expirou
          localStorage.removeItem(SESSION_STORAGE_KEY);
          await signOut(auth);
          setUser(null);
        }
      } else {
        // Garante que nunca inicie logado sem ter passado pela tela de login
        if (currentUser) {
          await signOut(auth);
        }
        localStorage.removeItem(SESSION_STORAGE_KEY);
        setUser(null);
      }

      setLoadingAuth(false);
    });

    return () => {
      if (logoutTimer) clearTimeout(logoutTimer);
      unsubscribe();
    };
  }, []);

  const loadOrCreateUserData = async (firebaseUser) => {
    const userRef = doc(db, "users", firebaseUser.uid);
    const snap = await getDoc(userRef);

    const isSuperAdmin = SUPERADMIN_EMAILS.includes(firebaseUser.email);

    if (snap.exists()) {
      const data = snap.data();
      const loadedSalary = Number(data.salary || 0);
      setUser({
        uid: firebaseUser.uid,
        name: data.name || firebaseUser.displayName || "Usuário",
        email: firebaseUser.email,
        role: data.role || (isSuperAdmin ? "superadmin" : "user"),
      });
      setSalary(loadedSalary);
      setSalaryInput(loadedSalary === 0 ? "" : String(loadedSalary));
      setFixedExpenses(data.fixedExpenses || []);
      setCards(data.cards || []);
      setExpenses(data.expenses || []);
    } else {
      const initialData = {
        name: firebaseUser.displayName || nameInput || "Usuário",
        email: firebaseUser.email,
        role: isSuperAdmin ? "superadmin" : "user",
        salary: 0,
        fixedExpenses: [],
        cards: [],
        expenses: [],
        createdAt: new Date().toISOString(),
      };
      await setDoc(userRef, initialData);
      setUser({
        uid: firebaseUser.uid,
        ...initialData,
      });
      setSalary(0);
      setSalaryInput("");
      setFixedExpenses([]);
      setCards([]);
      setExpenses([]);
    }
  };

  const saveUserData = async (updatedFields) => {
    if (!user) return;
    const userRef = doc(db, "users", user.uid);
    await setDoc(userRef, updatedFields, { merge: true });
  };

  // Login com Google (Registra o início dos 10 minutos)
  const handleGoogleLogin = async () => {
    setAuthError("");
    try {
      localStorage.setItem(SESSION_STORAGE_KEY, Date.now().toString());
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      localStorage.removeItem(SESSION_STORAGE_KEY);
      setAuthError("Erro ao autenticar com o Google: " + err.message);
    }
  };

  // Login ou Cadastro com E-mail e Senha (Registra o início dos 10 minutos)
  const handleEmailAuth = async (e) => {
    e.preventDefault();
    setAuthError("");
    try {
      localStorage.setItem(SESSION_STORAGE_KEY, Date.now().toString());
      if (isRegistering) {
        const cred = await createUserWithEmailAndPassword(
          auth,
          emailInput,
          passwordInput
        );
        if (nameInput) {
          await updateProfile(cred.user, { displayName: nameInput });
        }
        await loadOrCreateUserData(cred.user);
      } else {
        await signInWithEmailAndPassword(auth, emailInput, passwordInput);
      }
    } catch (err) {
      localStorage.removeItem(SESSION_STORAGE_KEY);
      setAuthError("Falha na autenticação: " + err.message);
    }
  };

  const handleLogout = async () => {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    await signOut(auth);
    setUser(null);
  };

  // --- FUNÇÕES DO PAINEL DE SALÁRIO ---
  const handleSaveSalary = async (e) => {
    if (e) e.preventDefault();
    const num = Number(salaryInput) || 0;
    setSalary(num);
    setIsEditingSalary(false);
    await saveUserData({ salary: num });
  };

  // --- FUNÇÕES DO PAINEL DE DESPESAS FIXAS ---
  const handleAddFixed = async (e) => {
    e.preventDefault();
    if (!fixedName.trim() || fixedAmount === "") return;
    const updated = [
      ...fixedExpenses,
      {
        id: Date.now().toString(),
        name: fixedName.trim(),
        amount: Number(fixedAmount) || 0,
      },
    ];
    setFixedExpenses(updated);
    setFixedName("");
    setFixedAmount("");
    await saveUserData({ fixedExpenses: updated });
  };

  const startEditFixed = (item) => {
    setEditingFixedId(item.id);
    setEditFixedName(item.name);
    setEditFixedAmount(String(item.amount));
  };

  const handleSaveFixedEdit = async (id) => {
    if (!editFixedName.trim()) return;
    const updated = fixedExpenses.map((item) =>
      item.id === id
        ? {
            ...item,
            name: editFixedName.trim(),
            amount: Number(editFixedAmount) || 0,
          }
        : item
    );
    setFixedExpenses(updated);
    setEditingFixedId(null);
    await saveUserData({ fixedExpenses: updated });
  };

  const handleRemoveFixed = async (id) => {
    const updated = fixedExpenses.filter((item) => item.id !== id);
    setFixedExpenses(updated);
    await saveUserData({ fixedExpenses: updated });
  };

  // --- FUNÇÕES DO PAINEL DE CARTÕES DE CRÉDITO ---
  const handleAddCard = async (e) => {
    e.preventDefault();
    if (!cardName.trim() || cardLimit === "") return;
    const updated = [
      ...cards,
      {
        id: Date.now().toString(),
        name: cardName.trim(),
        limit: Number(cardLimit) || 0,
      },
    ];
    setCards(updated);
    setCardName("");
    setCardLimit("");
    await saveUserData({ cards: updated });
  };

  const startEditCard = (card) => {
    setEditingCardId(card.id);
    setEditCardName(card.name);
    setEditCardLimit(String(card.limit));
  };

  const handleSaveCardEdit = async (id) => {
    if (!editCardName.trim()) return;
    const newName = editCardName.trim();
    const updatedCards = cards.map((c) =>
      c.id === id ? { ...c, name: newName, limit: Number(editCardLimit) || 0 } : c
    );
    // Atualiza também o nome do cartão nos gastos vinculados a ele
    const updatedExpenses = expenses.map((exp) =>
      exp.paymentSource === id ? { ...exp, paymentLabel: newName } : exp
    );

    setCards(updatedCards);
    setExpenses(updatedExpenses);
    setEditingCardId(null);
    await saveUserData({ cards: updatedCards, expenses: updatedExpenses });
  };

  const handleRemoveCard = async (id) => {
    const updated = cards.filter((c) => c.id !== id);
    setCards(updated);
    await saveUserData({ cards: updated });
  };

  // --- FUNÇÕES DO PAINEL DE GASTOS ---
  const handleAddExpense = async (e) => {
    e.preventDefault();
    if (!expWhat.trim() || !expWhere.trim() || expAmount === "") return;

    const total = Number(expAmount) || 0;
    const installments = Number(expInstallments) || 0;
    const installmentValue = installments > 0 ? total / installments : total;
    const selectedCard = cards.find((c) => c.id === expPaymentSource);

    const newExpense = {
      id: Date.now().toString(),
      what: expWhat.trim(),
      where: expWhere.trim(),
      totalAmount: total,
      installments,
      installmentValue,
      paymentSource: expPaymentSource,
      paymentLabel: selectedCard ? selectedCard.name : "Salário / À Vista",
      createdAt: new Date().toLocaleDateString("pt-BR"),
    };

    const updated = [newExpense, ...expenses];
    setExpenses(updated);
    setExpWhat("");
    setExpWhere("");
    setExpAmount("");
    setExpInstallments("");
    await saveUserData({ expenses: updated });
  };

  const startEditExpense = (exp) => {
    setEditingExpId(exp.id);
    setEditExpWhat(exp.what);
    setEditExpWhere(exp.where);
    setEditExpAmount(String(exp.totalAmount));
    setEditExpInstallments(String(exp.installments || 0));
    setEditExpPaymentSource(exp.paymentSource || "salary");
  };

  const handleSaveExpenseEdit = async (id) => {
    if (!editExpWhat.trim() || !editExpWhere.trim()) return;
    const total = Number(editExpAmount) || 0;
    const installments = Number(editExpInstallments) || 0;
    const installmentValue = installments > 0 ? total / installments : total;
    const selectedCard = cards.find((c) => c.id === editExpPaymentSource);

    const updated = expenses.map((exp) =>
      exp.id === id
        ? {
            ...exp,
            what: editExpWhat.trim(),
            where: editExpWhere.trim(),
            totalAmount: total,
            installments,
            installmentValue,
            paymentSource: editExpPaymentSource,
            paymentLabel: selectedCard
              ? selectedCard.name
              : "Salário / À Vista",
          }
        : exp
    );

    setExpenses(updated);
    setEditingExpId(null);
    await saveUserData({ expenses: updated });
  };

  const handleRemoveExpense = async (id) => {
    const updated = expenses.filter((exp) => exp.id !== id);
    setExpenses(updated);
    await saveUserData({ expenses: updated });
  };

  // --- FUNÇÕES SUPERADMIN ---
  const loadAllUsers = async () => {
    const snap = await getDocs(collection(db, "users"));
    const list = snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
    setAllUsers(list);
  };

  const toggleUserRole = async (targetUser) => {
    const newRole = targetUser.role === "superadmin" ? "user" : "superadmin";
    await setDoc(
      doc(db, "users", targetUser.uid),
      { role: newRole },
      { merge: true }
    );
    await loadAllUsers();
  };

  const deleteUserAccountData = async (uid) => {
    await deleteDoc(doc(db, "users", uid));
    await loadAllUsers();
  };

  // Cálculos de Totais
  const totalFixed = fixedExpenses.reduce(
    (acc, item) => acc + (Number(item.amount) || 0),
    0
  );
  const totalExpenses = expenses.reduce(
    (acc, item) => acc + (Number(item.totalAmount) || 0),
    0
  );
  const totalMonthlyInstallments = expenses.reduce(
    (acc, item) => acc + (Number(item.installmentValue) || 0),
    0
  );
  const totalSpentMonth = totalFixed + totalMonthlyInstallments;
  const remainingSalary = salary - totalSpentMonth;

  if (loadingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-200">
        Carregando...
      </div>
    );
  }

  // TELA DE LOGIN / CADASTRO
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-slate-100 dark:bg-slate-950">
        <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl p-6">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">
              Controle Financeiro
            </h1>
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
            >
              {darkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>

          {authError && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-500 text-sm">
              {authError}
            </div>
          )}

          <form onSubmit={handleEmailAuth} className="space-y-4">
            {isRegistering && (
              <div>
                <label className="block text-sm mb-1 text-slate-600 dark:text-slate-400">
                  Nome
                </label>
                <input
                  type="text"
                  required
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent text-slate-900 dark:text-white"
                  placeholder="Seu nome"
                />
              </div>
            )}
            <div>
              <label className="block text-sm mb-1 text-slate-600 dark:text-slate-400">
                E-mail
              </label>
              <input
                type="email"
                required
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent text-slate-900 dark:text-white"
                placeholder="seu@email.com"
              />
            </div>
            <div>
              <label className="block text-sm mb-1 text-slate-600 dark:text-slate-400">
                Senha
              </label>
              <input
                type="password"
                required
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent text-slate-900 dark:text-white"
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit"
              className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition"
            >
              {isRegistering ? "Criar Conta" : "Entrar"}
            </button>
          </form>

          <div className="my-4 flex items-center gap-2">
            <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
            <span className="text-xs text-slate-400">OU</span>
            <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
          </div>

          <button
            onClick={handleGoogleLogin}
            type="button"
            className="w-full py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-900 dark:text-white font-medium transition flex items-center justify-center gap-2"
          >
            Entrar com Google
          </button>

          <p className="mt-4 text-center text-sm text-slate-500">
            {isRegistering ? "Já possui conta?" : "Ainda não tem conta?"}{" "}
            <button
              type="button"
              onClick={() => setIsRegistering(!isRegistering)}
              className="text-emerald-500 font-medium hover:underline"
            >
              {isRegistering ? "Fazer Login" : "Cadastre-se"}
            </button>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* HEADER */}
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold">Controle Financeiro</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Olá, {user.name} ({user.email})
            </p>
          </div>

          <div className="flex items-center gap-3">
            {user.role === "superadmin" && (
              <button
                onClick={() => {
                  const next =
                    activeView === "dashboard" ? "superadmin" : "dashboard";
                  setActiveView(next);
                  if (next === "superadmin") loadAllUsers();
                }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-amber-500/10 text-amber-500 border border-amber-500/30"
              >
                <ShieldAlert size={16} />
                {activeView === "superadmin" ? "Voltar ao Painel" : "SuperAdmin"}
              </button>
            )}

            <button
              onClick={() => setDarkMode(!darkMode)}
              className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800"
              title="Alternar tema Claro/Escuro"
            >
              {darkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm bg-red-500/10 text-red-500 hover:bg-red-500/20"
            >
              <LogOut size={16} />
              Sair
            </button>
          </div>
        </div>
      </header>

      {/* PAINEL SUPERADMIN */}
      {activeView === "superadmin" && user.role === "superadmin" ? (
        <main className="max-w-7xl mx-auto p-4 space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <Users size={20} className="text-amber-500" />
              <h2 className="text-lg font-bold">
                Administração de Contas de Usuários
              </h2>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                    <th className="py-2">Nome</th>
                    <th className="py-2">E-mail</th>
                    <th className="py-2">Salário</th>
                    <th className="py-2">Permissão</th>
                    <th className="py-2 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {allUsers.map((u) => (
                    <tr key={u.uid}>
                      <td className="py-3 font-medium">{u.name}</td>
                      <td className="py-3">{u.email}</td>
                      <td className="py-3">{formatBRL(u.salary)}</td>
                      <td className="py-3">
                        <span className="px-2 py-0.5 rounded text-xs bg-slate-200 dark:bg-slate-800">
                          {u.role || "user"}
                        </span>
                      </td>
                      <td className="py-3 text-right space-x-2">
                        <button
                          onClick={() => toggleUserRole(u)}
                          className="px-2.5 py-1 rounded text-xs bg-blue-500/10 text-blue-500"
                        >
                          Alternar Admin
                        </button>
                        <button
                          onClick={() => deleteUserAccountData(u.uid)}
                          className="px-2.5 py-1 rounded text-xs bg-red-500/10 text-red-500"
                        >
                          Excluir Dados
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      ) : (
        /* DASHBOARD PRINCIPAL */
        <main className="max-w-7xl mx-auto p-4 grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* COLUNA ESQUERDA: SALÁRIO + DESPESAS FIXAS LOGO ABAIXO + TOTAL DE GASTOS */}
          <div className="lg:col-span-4 space-y-6">
            {/* 1. PAINEL DE SALÁRIO (EDITÁVEL NO PRÓPRIO PAINEL) */}
            <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-emerald-500">
                  <Wallet size={20} />
                  <h2 className="font-bold text-slate-900 dark:text-white">
                    Painel de Salário
                  </h2>
                </div>
                {!isEditingSalary && (
                  <button
                    onClick={() => {
                      setSalaryInput(salary === 0 ? "" : String(salary));
                      setIsEditingSalary(true);
                    }}
                    className="flex items-center gap-1 text-xs text-emerald-500 hover:underline"
                  >
                    <Pencil size={14} /> Editar
                  </button>
                )}
              </div>

              {isEditingSalary ? (
                <form onSubmit={handleSaveSalary} className="space-y-2">
                  <label className="block text-xs text-slate-500">
                    Digite manualmente seu salário mensal (R$)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      autoFocus
                      value={salaryInput}
                      onChange={(e) => setSalaryInput(e.target.value)}
                      placeholder="0.00"
                      className="flex-1 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent text-base font-semibold"
                    />
                    <button
                      type="submit"
                      className="p-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white"
                      title="Salvar Salário"
                    >
                      <Check size={18} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsEditingSalary(false)}
                      className="p-2 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-500"
                      title="Cancelar"
                    >
                      <X size={18} />
                    </button>
                  </div>
                </form>
              ) : (
                <div
                  onClick={() => {
                    setSalaryInput(salary === 0 ? "" : String(salary));
                    setIsEditingSalary(true);
                  }}
                  className="cursor-pointer p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-transparent hover:border-emerald-500/40 transition"
                >
                  <span className="block text-xs text-slate-500 mb-0.5">
                    Salário Mensal Atual (clique para editar)
                  </span>
                  <span className="text-2xl font-bold text-slate-900 dark:text-white">
                    {formatBRL(salary)}
                  </span>
                </div>
              )}

              <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-between text-sm">
                <span className="text-slate-500">Saldo livre estimado:</span>
                <span
                  className={
                    remainingSalary >= 0
                      ? "text-emerald-500 font-bold"
                      : "text-red-500 font-bold"
                  }
                >
                  {formatBRL(remainingSalary)}
                </span>
              </div>
            </section>

            {/* 2. PAINEL DE DESPESAS FIXAS (LOGO ABAIXO DO SALÁRIO + EDIÇÃO DIRETA) */}
            <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-blue-500">
                  <Home size={20} />
                  <h2 className="font-bold text-slate-900 dark:text-white">
                    Despesas Fixas
                  </h2>
                </div>
                <span className="text-sm font-semibold text-slate-500">
                  {formatBRL(totalFixed)}
                </span>
              </div>

              <form onSubmit={handleAddFixed} className="flex gap-2 mb-4">
                <input
                  type="text"
                  placeholder="Aluguel, Luz, Academia..."
                  value={fixedName}
                  onChange={(e) => setFixedName(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent text-sm"
                />
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Valor"
                  value={fixedAmount}
                  onChange={(e) => setFixedAmount(e.target.value)}
                  className="w-24 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent text-sm"
                />
                <button
                  type="submit"
                  className="p-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white"
                  title="Adicionar Despesa Fixa"
                >
                  <Plus size={18} />
                </button>
              </form>

              <div className="space-y-2 max-h-60 overflow-y-auto">
                {fixedExpenses.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-2">
                    Nenhuma despesa fixa cadastrada.
                  </p>
                ) : (
                  fixedExpenses.map((item) => (
                    <div
                      key={item.id}
                      className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 text-sm"
                    >
                      {editingFixedId === item.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={editFixedName}
                            onChange={(e) => setEditFixedName(e.target.value)}
                            className="flex-1 px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                          />
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={editFixedAmount}
                            onChange={(e) => setEditFixedAmount(e.target.value)}
                            className="w-20 px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                          />
                          <button
                            onClick={() => handleSaveFixedEdit(item.id)}
                            className="text-emerald-500 hover:text-emerald-400"
                            title="Salvar"
                          >
                            <Check size={16} />
                          </button>
                          <button
                            onClick={() => setEditingFixedId(null)}
                            className="text-slate-400 hover:text-slate-300"
                            title="Cancelar"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <span>{item.name}</span>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">
                              {formatBRL(item.amount)}
                            </span>
                            <button
                              onClick={() => startEditFixed(item)}
                              className="text-slate-400 hover:text-blue-500"
                              title="Editar despesa"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              onClick={() => handleRemoveFixed(item.id)}
                              className="text-slate-400 hover:text-red-500"
                              title="Excluir despesa"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </section>

            {/* 3. PAINEL DE TOTAL DE GASTOS */}
            <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3 text-rose-500">
                <TrendingDown size={20} />
                <h2 className="font-bold text-slate-900 dark:text-white">
                  Total de Gastos
                </h2>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Despesas Fixas:</span>
                  <span className="font-medium">{formatBRL(totalFixed)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">
                    Parcelas / Gastos do Mês:
                  </span>
                  <span className="font-medium">
                    {formatBRL(totalMonthlyInstallments)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">
                    Total Acumulado de Compras:
                  </span>
                  <span className="font-medium">
                    {formatBRL(totalExpenses)}
                  </span>
                </div>
                <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex justify-between text-base font-bold">
                  <span>Total Mensal Comprometido:</span>
                  <span className="text-rose-500">
                    {formatBRL(totalSpentMonth)}
                  </span>
                </div>
              </div>
            </section>
          </div>

          {/* COLUNA DIREITA: CARTÕES DE CRÉDITO + LANÇAR GASTO + LISTA DE GASTOS E PARCELAS */}
          <div className="lg:col-span-8 space-y-6">
            {/* 4. PAINEL DE CARTÕES DE CRÉDITO E LIMITES (EDIÇÃO DIRETA NO CARD) */}
            <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4 text-purple-500">
                <CreditCard size={20} />
                <h2 className="font-bold text-slate-900 dark:text-white">
                  Cartões de Crédito e Limites
                </h2>
              </div>

              <form
                onSubmit={handleAddCard}
                className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4"
              >
                <input
                  type="text"
                  placeholder="Nome do Cartão (ex: Nubank, Inter)"
                  value={cardName}
                  onChange={(e) => setCardName(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent text-sm"
                />
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Limite Total (R$)"
                  value={cardLimit}
                  onChange={(e) => setCardLimit(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent text-sm"
                />
                <button
                  type="submit"
                  className="py-2 px-4 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium flex items-center justify-center gap-1.5"
                >
                  <Plus size={16} /> Adicionar Cartão
                </button>
              </form>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {cards.length === 0 ? (
                  <p className="text-xs text-slate-500 col-span-2 py-2">
                    Nenhum cartão cadastrado.
                  </p>
                ) : (
                  cards.map((card) => {
                    const used = expenses
                      .filter((e) => e.paymentSource === card.id)
                      .reduce(
                        (acc, e) => acc + (Number(e.totalAmount) || 0),
                        0
                      );
                    const available = (Number(card.limit) || 0) - used;

                    return (
                      <div
                        key={card.id}
                        className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40"
                      >
                        {editingCardId === card.id ? (
                          <div className="space-y-2">
                            <div>
                              <label className="block text-[11px] text-slate-400">
                                Nome do Cartão
                              </label>
                              <input
                                type="text"
                                value={editCardName}
                                onChange={(e) =>
                                  setEditCardName(e.target.value)
                                }
                                className="w-full px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] text-slate-400">
                                Limite Total (R$)
                              </label>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={editCardLimit}
                                onChange={(e) =>
                                  setEditCardLimit(e.target.value)
                                }
                                className="w-full px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                              />
                            </div>
                            <div className="flex justify-end gap-2 pt-1">
                              <button
                                onClick={() => handleSaveCardEdit(card.id)}
                                className="px-3 py-1 rounded bg-emerald-600 text-white text-xs flex items-center gap-1"
                              >
                                <Check size={14} /> Salvar
                              </button>
                              <button
                                onClick={() => setEditingCardId(null)}
                                className="px-3 py-1 rounded bg-slate-200 dark:bg-slate-700 text-xs flex items-center gap-1"
                              >
                                <X size={14} /> Cancelar
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="flex justify-between items-center mb-2">
                              <span className="font-bold">{card.name}</span>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => startEditCard(card)}
                                  className="text-slate-400 hover:text-purple-500"
                                  title="Editar cartão"
                                >
                                  <Pencil size={14} />
                                </button>
                                <button
                                  onClick={() => handleRemoveCard(card.id)}
                                  className="text-slate-400 hover:text-red-500"
                                  title="Excluir cartão"
                                >
                                  <Trash2 size={15} />
                                </button>
                              </div>
                            </div>
                            <div className="text-xs space-y-1 text-slate-500 dark:text-slate-400">
                              <div className="flex justify-between">
                                <span>Limite Total:</span>
                                <span className="font-medium text-slate-900 dark:text-white">
                                  {formatBRL(card.limit)}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span>Utilizado:</span>
                                <span className="font-medium text-rose-500">
                                  {formatBRL(used)}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span>Disponível:</span>
                                <span className="font-medium text-emerald-500">
                                  {formatBRL(available)}
                                </span>
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </section>

            {/* 5. PAINEL PARA INFORMAR O QUE FOI GASTO, ONDE E QUANTO FOI */}
            <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4 text-emerald-500">
                <ShoppingBag size={20} />
                <h2 className="font-bold text-slate-900 dark:text-white">
                  Registrar Novo Gasto
                </h2>
              </div>

              <form
                onSubmit={handleAddExpense}
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
              >
                <input
                  type="text"
                  placeholder="O que foi gasto?"
                  value={expWhat}
                  onChange={(e) => setExpWhat(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent text-sm"
                />
                <input
                  type="text"
                  placeholder="Onde foi gasto?"
                  value={expWhere}
                  onChange={(e) => setExpWhere(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent text-sm"
                />
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Quanto foi? (Total R$)"
                  value={expAmount}
                  onChange={(e) => setExpAmount(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent text-sm"
                />
                <select
                  value={expPaymentSource}
                  onChange={(e) => setExpPaymentSource(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                >
                  <option value="salary">Salário / Pix / Débito</option>
                  {cards.map((c) => (
                    <option key={c.id} value={c.id}>
                      Cartão: {c.name}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min="0"
                  max="48"
                  placeholder="Parcelas (0 = à vista)"
                  value={expInstallments}
                  onChange={(e) => setExpInstallments(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent text-sm"
                />
                <button
                  type="submit"
                  className="py-2 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium flex items-center justify-center gap-1.5"
                >
                  <Plus size={16} /> Lançar Gasto
                </button>
              </form>
            </section>

            {/* 6. PAINEL INFORMANDO O QUE FOI GASTO, TOTAL E PARCELAS (COM EDIÇÃO DIRETA) */}
            <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4 text-amber-500">
                <Layers size={20} />
                <h2 className="font-bold text-slate-900 dark:text-white">
                  Histórico de Gastos, Total e Parcelas
                </h2>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                      <th className="py-2">O que foi gasto</th>
                      <th className="py-2">Onde</th>
                      <th className="py-2">Forma / Cartão</th>
                      <th className="py-2">Parcelas</th>
                      <th className="py-2">Total</th>
                      <th className="py-2 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {expenses.length === 0 ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="py-4 text-center text-xs text-slate-500"
                        >
                          Nenhum gasto registrado até o momento.
                        </td>
                      </tr>
                    ) : (
                      expenses.map((exp) => (
                        <tr key={exp.id}>
                          {editingExpId === exp.id ? (
                            <>
                              <td className="py-2 pr-2">
                                <input
                                  type="text"
                                  value={editExpWhat}
                                  onChange={(e) =>
                                    setEditExpWhat(e.target.value)
                                  }
                                  className="w-full px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                                />
                              </td>
                              <td className="py-2 pr-2">
                                <input
                                  type="text"
                                  value={editExpWhere}
                                  onChange={(e) =>
                                    setEditExpWhere(e.target.value)
                                  }
                                  className="w-full px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                                />
                              </td>
                              <td className="py-2 pr-2">
                                <select
                                  value={editExpPaymentSource}
                                  onChange={(e) =>
                                    setEditExpPaymentSource(e.target.value)
                                  }
                                  className="w-full px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                                >
                                  <option value="salary">
                                    Salário / À Vista
                                  </option>
                                  {cards.map((c) => (
                                    <option key={c.id} value={c.id}>
                                      {c.name}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td className="py-2 pr-2">
                                <input
                                  type="number"
                                  min="0"
                                  value={editExpInstallments}
                                  onChange={(e) =>
                                    setEditExpInstallments(e.target.value)
                                  }
                                  className="w-16 px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                                />
                              </td>
                              <td className="py-2 pr-2">
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={editExpAmount}
                                  onChange={(e) =>
                                    setEditExpAmount(e.target.value)
                                  }
                                  className="w-24 px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                                />
                              </td>
                              <td className="py-2 text-right space-x-2">
                                <button
                                  onClick={() => handleSaveExpenseEdit(exp.id)}
                                  className="text-emerald-500 hover:text-emerald-400"
                                  title="Salvar"
                                >
                                  <Check size={16} />
                                </button>
                                <button
                                  onClick={() => setEditingExpId(null)}
                                  className="text-slate-400 hover:text-slate-300"
                                  title="Cancelar"
                                >
                                  <X size={16} />
                                </button>
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="py-3 font-medium">{exp.what}</td>
                              <td className="py-3 text-slate-500">
                                {exp.where}
                              </td>
                              <td className="py-3">{exp.paymentLabel}</td>
                              <td className="py-3">
                                {Number(exp.installments) > 0 ? (
                                  <>
                                    {exp.installments}x de{" "}
                                    <span className="font-medium">
                                      {formatBRL(exp.installmentValue)}
                                    </span>
                                  </>
                                ) : (
                                  <span>À vista</span>
                                )}
                              </td>
                              <td className="py-3 font-bold">
                                {formatBRL(exp.totalAmount)}
                              </td>
                              <td className="py-3 text-right space-x-2">
                                <button
                                  onClick={() => startEditExpense(exp)}
                                  className="text-slate-400 hover:text-amber-500"
                                  title="Editar gasto"
                                >
                                  <Pencil size={14} />
                                </button>
                                <button
                                  onClick={() => handleRemoveExpense(exp.id)}
                                  className="text-slate-400 hover:text-red-500"
                                  title="Excluir gasto"
                                >
                                  <Trash2 size={15} />
                                </button>
                              </td>
                            </>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </main>
      )}
    </div>
  );
}
