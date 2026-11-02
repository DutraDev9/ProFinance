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
} from "lucide-react";

// Defina aqui o e-mail que terá acesso SuperAdmin automaticamente
const SUPERADMIN_EMAILS = ["admin@financas.com"];

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

  // Dados Financeiros do Usuário
  const [salary, setSalary] = useState(0);
  const [fixedExpenses, setFixedExpenses] = useState([]);
  const [cards, setCards] = useState([]);
  const [expenses, setExpenses] = useState([]);

  // Inputs de Despesas Fixas
  const [fixedName, setFixedName] = useState("");
  const [fixedAmount, setFixedAmount] = useState("");

  // Inputs de Cartões de Crédito
  const [cardName, setCardName] = useState("");
  const [cardLimit, setCardLimit] = useState("");

  // Inputs de Gastos
  const [expWhat, setExpWhat] = useState("");
  const [expWhere, setExpWhere] = useState("");
  const [expAmount, setExpAmount] = useState("");
  const [expInstallments, setExpInstallments] = useState(1);
  const [expPaymentSource, setExpPaymentSource] = useState("salary");

  // Lista de usuários para o SuperAdmin
  const [allUsers, setAllUsers] = useState([]);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [darkMode]);

  // Monitora autenticação no Firebase
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        await loadOrCreateUserData(currentUser);
      } else {
        setUser(null);
      }
      setLoadingAuth(false);
    });
    return () => unsubscribe();
  }, []);

  const loadOrCreateUserData = async (firebaseUser) => {
    const userRef = doc(db, "users", firebaseUser.uid);
    const snap = await getDoc(userRef);

    const isSuperAdmin = SUPERADMIN_EMAILS.includes(firebaseUser.email);

    if (snap.exists()) {
      const data = snap.data();
      setUser({
        uid: firebaseUser.uid,
        name: data.name || firebaseUser.displayName || "Usuário",
        email: firebaseUser.email,
        role: data.role || (isSuperAdmin ? "superadmin" : "user"),
      });
      setSalary(data.salary || 0);
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
      setFixedExpenses([]);
      setCards([]);
      setExpenses([]);
    }
  };

  // Salva alterações no Firestore
  const saveUserData = async (updatedFields) => {
    if (!user) return;
    const userRef = doc(db, "users", user.uid);
    await setDoc(userRef, updatedFields, { merge: true });
  };

  // Login com Google
  const handleGoogleLogin = async () => {
    setAuthError("");
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setAuthError("Erro ao autenticar com o Google: " + err.message);
    }
  };

  // Login ou Cadastro com E-mail e Senha
  const handleEmailAuth = async (e) => {
    e.preventDefault();
    setAuthError("");
    try {
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
      setAuthError("Falha na autenticação: " + err.message);
    }
  };

  // Funções de Salário
  const handleSalaryChange = async (val) => {
    const num = Number(val) || 0;
    setSalary(num);
    await saveUserData({ salary: num });
  };

  // Funções de Despesas Fixas
  const handleAddFixed = async (e) => {
    e.preventDefault();
    if (!fixedName.trim() || !fixedAmount) return;
    const updated = [
      ...fixedExpenses,
      {
        id: Date.now().toString(),
        name: fixedName.trim(),
        amount: Number(fixedAmount),
      },
    ];
    setFixedExpenses(updated);
    setFixedName("");
    setFixedAmount("");
    await saveUserData({ fixedExpenses: updated });
  };

  const handleRemoveFixed = async (id) => {
    const updated = fixedExpenses.filter((item) => item.id !== id);
    setFixedExpenses(updated);
    await saveUserData({ fixedExpenses: updated });
  };

  // Funções de Cartão de Crédito
  const handleAddCard = async (e) => {
    e.preventDefault();
    if (!cardName.trim() || !cardLimit) return;
    const updated = [
      ...cards,
      {
        id: Date.now().toString(),
        name: cardName.trim(),
        limit: Number(cardLimit),
      },
    ];
    setCards(updated);
    setCardName("");
    setCardLimit("");
    await saveUserData({ cards: updated });
  };

  const handleRemoveCard = async (id) => {
    const updated = cards.filter((c) => c.id !== id);
    setCards(updated);
    await saveUserData({ cards: updated });
  };

  // Funções de Gastos
  const handleAddExpense = async (e) => {
    e.preventDefault();
    if (!expWhat.trim() || !expWhere.trim() || !expAmount) return;

    const total = Number(expAmount);
    const installments = Math.max(1, Number(expInstallments) || 1);
    const selectedCard = cards.find((c) => c.id === expPaymentSource);

    const newExpense = {
      id: Date.now().toString(),
      what: expWhat.trim(),
      where: expWhere.trim(),
      totalAmount: total,
      installments,
      installmentValue: total / installments,
      paymentSource: expPaymentSource,
      paymentLabel: selectedCard ? selectedCard.name : "Salário / À Vista",
      createdAt: new Date().toLocaleDateString("pt-BR"),
    };

    const updated = [newExpense, ...expenses];
    setExpenses(updated);
    setExpWhat("");
    setExpWhere("");
    setExpAmount("");
    setExpInstallments(1);
    await saveUserData({ expenses: updated });
  };

  const handleRemoveExpense = async (id) => {
    const updated = expenses.filter((exp) => exp.id !== id);
    setExpenses(updated);
    await saveUserData({ expenses: updated });
  };

  // Funções SuperAdmin
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
  const totalFixed = fixedExpenses.reduce((acc, item) => acc + item.amount, 0);
  const totalExpenses = expenses.reduce(
    (acc, item) => acc + item.totalAmount,
    0
  );
  const totalMonthlyInstallments = expenses.reduce(
    (acc, item) => acc + item.installmentValue,
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
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent"
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
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent"
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
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent"
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
            className="w-full py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 font-medium transition flex items-center justify-center gap-2"
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
              onClick={() => signOut(auth)}
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
            {/* 1. PAINEL DE SALÁRIO */}
            <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3 text-emerald-500">
                <Wallet size={20} />
                <h2 className="font-bold text-slate-900 dark:text-white">
                  Painel de Salário
                </h2>
              </div>
              <label className="block text-xs text-slate-500 mb-1">
                Informe seu salário mensal (R$)
              </label>
              <input
                type="number"
                step="0.01"
                value={salary || ""}
                onChange={(e) => handleSalaryChange(e.target.value)}
                placeholder="Ex: 3500.00"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent text-lg font-semibold"
              />
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

            {/* 2. PAINEL DE DESPESAS FIXAS (LOGO ABAIXO DO SALÁRIO) */}
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
                  placeholder="Valor"
                  value={fixedAmount}
                  onChange={(e) => setFixedAmount(e.target.value)}
                  className="w-24 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent text-sm"
                />
                <button
                  type="submit"
                  className="p-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white"
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
                      className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 text-sm"
                    >
                      <span>{item.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {formatBRL(item.amount)}
                        </span>
                        <button
                          onClick={() => handleRemoveFixed(item.id)}
                          className="text-slate-400 hover:text-red-500"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
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
            {/* 4. PAINEL DE CARTÕES DE CRÉDITO E LIMITES */}
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
                      .reduce((acc, e) => acc + e.totalAmount, 0);
                    const available = card.limit - used;

                    return (
                      <div
                        key={card.id}
                        className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40"
                      >
                        <div className="flex justify-between items-center mb-2">
                          <span className="font-bold">{card.name}</span>
                          <button
                            onClick={() => handleRemoveCard(card.id)}
                            className="text-slate-400 hover:text-red-500"
                          >
                            <Trash2 size={15} />
                          </button>
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
                  min="1"
                  max="48"
                  placeholder="Parcelas (1 = à vista)"
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

            {/* 6. PAINEL INFORMANDO O QUE FOI GASTO, TOTAL E PARCELAS */}
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
                      <th className="py-2 text-right">Ação</th>
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
                          <td className="py-3 font-medium">{exp.what}</td>
                          <td className="py-3 text-slate-500">{exp.where}</td>
                          <td className="py-3">{exp.paymentLabel}</td>
                          <td className="py-3">
                            {exp.installments}x de{" "}
                            <span className="font-medium">
                              {formatBRL(exp.installmentValue)}
                            </span>
                          </td>
                          <td className="py-3 font-bold">
                            {formatBRL(exp.totalAmount)}
                          </td>
                          <td className="py-3 text-right">
                            <button
                              onClick={() => handleRemoveExpense(exp.id)}
                              className="text-slate-400 hover:text-red-500"
                            >
                              <Trash2 size={15} />
                            </button>
                          </td>
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
