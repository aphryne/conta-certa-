'use strict';

const STORAGE_KEY = 'contaCertaLancamentosV1';
const money = value => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
const dateBR = value => {
  if (!value) return '—';
  const [y,m,d] = value.split('-');
  return `${d}/${m}/${y}`;
};
const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};
const demoData = () => {
  const date = todayISO();
  const income = [
    ['Cliente A','Serviços',3000],['Cliente B','Serviços',2500],['Cliente C','Consultoria',2000],
    ['Cliente D','Serviços',1800],['Cliente E','Outras receitas',1700]
  ].map((x,i)=>({id:`demo-in-${i}`,type:'income',description:x[0],category:x[1],amount:x[2],date}));
  const expenses = [
    ['Aluguel','Aluguel',2000],['Salários e encargos','Salários e encargos',3500],
    ['Internet e telefone','Internet e telefone',350],['Energia elétrica','Energia elétrica',450],
    ['Material de escritório','Material de escritório',500],['Assinaturas de softwares','Assinaturas de softwares',600],
    ['Água e limpeza','Água e limpeza',300],['Marketing','Marketing',400]
  ].map((x,i)=>({id:`demo-out-${i}`,type:'expense',description:x[0],category:x[1],amount:x[2],date}));
  return [...income,...expenses];
};
let entries = loadEntries();
let toastTimer;

function loadEntries(){
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved !== null) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (error) { console.warn('Não foi possível ler os dados salvos.', error); }
  const initial = demoData();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
  return initial;
}
function saveEntries(){
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(entries)); }
  catch (error) { showToast('Não foi possível salvar. Verifique o armazenamento do navegador.'); }
}
function totals(){
  const income = entries.filter(e=>e.type==='income').reduce((s,e)=>s+Number(e.amount),0);
  const expense = entries.filter(e=>e.type==='expense').reduce((s,e)=>s+Number(e.amount),0);
  return {income,expense,balance:income-expense,count:entries.length};
}
function showToast(message){
  const el=document.getElementById('toast');
  el.textContent=message;el.classList.add('show');
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),2800);
}
function escapeHTML(value){
  return String(value).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function render(){
  renderDashboard();renderLists();renderAnalysis();
}
function renderDashboard(){
  const t=totals();
  document.getElementById('dashIncome').textContent=money(t.income);
  document.getElementById('dashExpense').textContent=money(t.expense);
  const balanceEl=document.getElementById('dashBalance');
  balanceEl.textContent=money(t.balance);balanceEl.style.color=t.balance<0?'#d76565':'#172b40';
  document.getElementById('dashCount').textContent=t.count;
  const summary=[];
  if(t.balance>0) summary.push(`O caixa apresenta saldo positivo de ${money(t.balance)}. Continue acompanhando as entradas e saídas.`);
  else if(t.balance<0) summary.push(`As despesas superam as receitas em ${money(Math.abs(t.balance))}. Vale revisar os custos e o planejamento de caixa.`);
  else summary.push('Receitas e despesas estão equilibradas. Acompanhe os próximos lançamentos para manter esse cenário.');
  if(t.expense>0){
    const ratio=t.income>0?(t.expense/t.income)*100:100;
    summary.push(`As despesas representam ${ratio.toLocaleString('pt-BR',{maximumFractionDigits:1})}% das receitas cadastradas.`);
  } else summary.push('Ainda não há despesas registradas.');
  const largest=[...entries].filter(e=>e.type==='expense').sort((a,b)=>b.amount-a.amount)[0];
  if(largest) summary.push(`Maior despesa individual: ${largest.description} (${money(largest.amount)}).`);
  document.getElementById('financialSummary').innerHTML=summary.map((s,i)=>`<div class="summary-line ${i===0&&t.balance<0?'warning':''}"><span class="summary-bullet"></span><span>${escapeHTML(s)}</span></div>`).join('');
  const recent=[...entries].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,6);
  document.getElementById('recentTable').innerHTML=recent.length?recent.map(e=>`<tr><td>${escapeHTML(e.description)}</td><td>${escapeHTML(e.category)}</td><td>${dateBR(e.date)}</td><td><span class="type-label ${e.type}">${e.type==='income'?'Receita':'Despesa'}</span></td><td class="align-right">${money(e.amount)}</td></tr>`).join(''):'<tr><td colspan="5" class="empty-state">Nenhuma movimentação cadastrada.</td></tr>';
  renderChart();
}
const chartColors=['#1eaa72','#284d6a','#79b6d4','#e6ae63','#9c91ca','#d77e7e','#78a58c','#9aa9b6','#d4a3c1'];
function renderChart(){
  const groups=groupExpenses();
  const canvas=document.getElementById('expenseChart');
  const legend=document.getElementById('chartLegend');
  const data=Object.entries(groups).sort((a,b)=>b[1]-a[1]);
  legend.innerHTML=data.length?data.map(([name,val],i)=>`<div class="legend-item"><div class="legend-name"><i class="legend-dot" style="background:${chartColors[i%chartColors.length]}"></i><span>${escapeHTML(name)}</span></div><span class="legend-value">${money(val)}</span></div>`).join(''):'<div class="empty-state">Cadastre despesas para visualizar o gráfico.</div>';
  const ctx=canvas.getContext('2d');
  const rect=canvas.getBoundingClientRect(),dpr=window.devicePixelRatio||1;
  canvas.width=Math.max(1,rect.width*dpr);canvas.height=Math.max(1,rect.height*dpr);
  ctx.scale(dpr,dpr);const w=rect.width,h=rect.height;ctx.clearRect(0,0,w,h);
  const total=data.reduce((s,x)=>s+x[1],0);
  if(!total){ctx.beginPath();ctx.arc(w/2,h/2,57,0,Math.PI*2);ctx.strokeStyle='#edf2f5';ctx.lineWidth=19;ctx.stroke();ctx.fillStyle='#81919e';ctx.textAlign='center';ctx.font='11px DM Sans';ctx.fillText('Sem despesas',w/2,h/2+4);return;}
  let start=-Math.PI/2;
  data.forEach(([name,val],i)=>{const end=start+(val/total)*Math.PI*2;ctx.beginPath();ctx.arc(w/2,h/2,61,start,end);ctx.strokeStyle=chartColors[i%chartColors.length];ctx.lineWidth=19;ctx.lineCap='butt';ctx.stroke();start=end;});
  ctx.textAlign='center';ctx.fillStyle='#183650';ctx.font='700 13px Manrope';ctx.fillText(money(total).replace(',00',''),w/2,h/2-1);ctx.fillStyle='#8999a6';ctx.font='9px DM Sans';ctx.fillText('em despesas',w/2,h/2+14);
}
function groupExpenses(){
  return entries.filter(e=>e.type==='expense').reduce((acc,e)=>{acc[e.category]=(acc[e.category]||0)+Number(e.amount);return acc;},{});
}
function renderLists(){
  ['income','expense'].forEach(type=>{
    const list=entries.filter(e=>e.type===type).sort((a,b)=>b.date.localeCompare(a.date));
    const sum=list.reduce((s,e)=>s+Number(e.amount),0);
    const prefix=type==='income'?'income':'expense';
    document.getElementById(`${prefix}Count`).textContent=`${list.length} ${list.length===1?'registro':'registros'}`;
    document.getElementById(`${prefix}Total`).textContent=money(sum);
    document.getElementById(`${prefix}List`).innerHTML=list.length?list.map(e=>`
      <div class="transaction-item">
        <span class="transaction-symbol ${type}">${type==='income'?'↗':'↙'}</span>
        <div class="transaction-info"><strong>${escapeHTML(e.description)}</strong><small>${escapeHTML(e.category)} · ${dateBR(e.date)}</small></div>
        <span class="transaction-amount">${money(e.amount)}</span>
        <button class="delete-btn" data-delete="${escapeHTML(e.id)}" aria-label="Excluir ${escapeHTML(e.description)}" title="Excluir lançamento">×</button>
      </div>`).join(''):'<div class="empty-state">Nenhum lançamento por aqui ainda.<br>Use o formulário ao lado para adicionar.</div>';
  });
}
function estimateSavings(groups){
  // Percentuais ilustrativos, aplicados apenas às categorias com uma hipótese de otimização.
  const rules={
    'Assinaturas de softwares':{rate:.15,title:'Revisar assinaturas',tip:'Verifique ferramentas pouco utilizadas, planos duplicados e opções de pacote mais econômico.'},
    'Internet e telefone':{rate:.10,title:'Negociar telecomunicações',tip:'Compare planos e avalie a renegociação do pacote de internet e telefonia.'},
    'Energia elétrica':{rate:.08,title:'Reduzir consumo de energia',tip:'Adote desligamento de equipamentos ociosos e acompanhe o consumo mensal.'},
    'Material de escritório':{rate:.10,title:'Planejar compras',tip:'Consolide pedidos, compare fornecedores e evite compras urgentes em pequenas quantidades.'},
    'Marketing':{rate:.08,title:'Avaliar retorno do marketing',tip:'Compare o custo e o resultado de cada canal antes de renovar campanhas.'},
    'Água e limpeza':{rate:.05,title:'Otimizar recursos',tip:'Revise rotinas de consumo e compras de materiais de limpeza.'}
  };
  return Object.entries(groups).filter(([cat])=>rules[cat]).map(([cat,val])=>({category:cat,amount:val*rules[cat].rate,rate:rules[cat].rate,...rules[cat]})).filter(x=>x.amount>0);
}
function renderAnalysis(){
  const t=totals(),groups=groupExpenses(),totalExpense=t.expense;
  const top=[...entries].filter(e=>e.type==='expense').sort((a,b)=>b.amount-a.amount).slice(0,3);
  document.getElementById('topExpenses').innerHTML=top.length?top.map((e,i)=>`<div class="rank-item"><span class="rank-number">${i+1}</span><div class="rank-info"><strong>${escapeHTML(e.description)}</strong><small>${escapeHTML(e.category)}</small></div><span class="rank-value">${money(e.amount)}</span></div>`).join(''):'<div class="empty-state">Cadastre despesas para identificar os maiores gastos.</div>';
  const breakdown=Object.entries(groups).sort((a,b)=>b[1]-a[1]);
  document.getElementById('categoryBreakdown').innerHTML=breakdown.length?breakdown.map(([cat,val])=>{const pct=totalExpense?val/totalExpense*100:0;return `<div><div class="breakdown-top"><strong>${escapeHTML(cat)}</strong><span>${pct.toLocaleString('pt-BR',{maximumFractionDigits:1})}% · ${money(val)}</span></div><div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div></div>`;}).join(''):'<div class="empty-state">Sem dados para calcular percentuais.</div>';
  const suggestions=estimateSavings(groups),saving=suggestions.reduce((s,x)=>s+x.amount,0);
  document.getElementById('savingSuggestions').innerHTML=suggestions.length?suggestions.map(s=>`<div class="suggestion-card"><span class="suggestion-tag">${escapeHTML(s.category)}</span><strong>${escapeHTML(s.title)}</strong><p>${escapeHTML(s.tip)}</p><small>Potencial estimado: ${money(s.amount)}</small></div>`).join(''):'<div class="empty-state">Ainda não há categorias com sugestões automáticas. Cadastre despesas para ampliar a análise.</div>';
  document.getElementById('beforeSaving').textContent=money(t.balance);
  document.getElementById('savingAmount').textContent=money(saving);
  document.getElementById('afterSaving').textContent=money(t.balance+saving);
  document.getElementById('afterSaving').style.color=(t.balance+saving)>=0?'#13865a':'#d76565';
  const headline=totalExpense?`As despesas somam ${money(totalExpense)}. ${suggestions.length?`As sugestões identificaram até ${money(saving)} em economia potencial, conforme percentuais ilustrativos.`:'Não foram encontradas categorias com regras de economia nesta demonstração.'}`:'Cadastre despesas para que o sistema identifique padrões e oportunidades.';
  document.getElementById('analysisHeadline').textContent=headline;
}
function addEntry(type,form){
  const fd=new FormData(form),description=String(fd.get('description')||'').trim(),category=String(fd.get('category')||''),amount=Number(fd.get('amount')),date=String(fd.get('date')||'');
  if(!description||!category||!Number.isFinite(amount)||amount<=0||!date){showToast('Confira os campos e informe um valor maior que zero.');return;}
  entries.push({id:`${type}-${Date.now()}-${Math.random().toString(16).slice(2)}`,type,description,category,amount:Math.round(amount*100)/100,date});
  saveEntries();form.reset();form.querySelector('input[type="date"]').value=todayISO();render();showToast(type==='income'?'Receita cadastrada com sucesso!':'Despesa cadastrada com sucesso!');
}
function navigate(view){
  document.querySelectorAll('.view').forEach(el=>el.classList.toggle('active',el.id===`view-${view}`));
  document.querySelectorAll('.nav-link').forEach(el=>el.classList.toggle('active',el.dataset.view===view));
  const titles={dashboard:'Visão geral',receitas:'Receitas',despesas:'Despesas',analise:'Análise inteligente'};
  document.getElementById('pageTitle').textContent=titles[view]||'Visão geral';
  document.getElementById('sidebar').classList.remove('open');
  if(view==='dashboard')renderChart();
}
document.addEventListener('click',event=>{
  const nav=event.target.closest('[data-view]');
  if(nav){event.preventDefault();navigate(nav.dataset.view);return;}
  const del=event.target.closest('[data-delete]');
  if(del){
    const entry=entries.find(e=>e.id===del.dataset.delete);
    if(entry&&confirm(`Deseja excluir "${entry.description}"?`)){
      entries=entries.filter(e=>e.id!==entry.id);saveEntries();render();showToast('Lançamento excluído.');
    }
  }
});
document.getElementById('incomeForm').addEventListener('submit',e=>{e.preventDefault();addEntry('income',e.currentTarget);});
document.getElementById('expenseForm').addEventListener('submit',e=>{e.preventDefault();addEntry('expense',e.currentTarget);});
document.getElementById('resetData').addEventListener('click',()=>{
  if(confirm('Isso substituirá todos os lançamentos atuais pelos dados fictícios iniciais. Deseja continuar?')){
    entries=demoData();saveEntries();render();showToast('Dados fictícios restaurados com sucesso!');
  }
});
document.getElementById('mobileMenu').addEventListener('click',()=>document.getElementById('sidebar').classList.toggle('open'));
document.getElementById('year').textContent=new Date().getFullYear();
document.getElementById('todayLabel').textContent=new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'long',year:'numeric'}).format(new Date());
document.querySelectorAll('input[type="date"]').forEach(input=>input.value=todayISO());
window.addEventListener('resize',()=>{if(document.getElementById('view-dashboard').classList.contains('active'))renderChart();});
render();
