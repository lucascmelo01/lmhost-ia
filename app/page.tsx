"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "../lib/supabase";

type Property = { id:string; name:string; type:string; address:string; dailyRate:number; cleaningFee:number; guests:number; wifi:string; password:string; ical:string; status:string; };
type Reservation = { id:string; propertyId:string; guest:string; checkIn:string; checkOut:string; value:number; source:string };
type Cleaning = { id:string; propertyId:string; date:string; status:"Pendente"|"Em andamento"|"Concluída" };
type Expense = { id:string; propertyId:string; title:string; value:number; date:string };

const money=(v:number)=>v.toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const days=(a:string,b:string)=>!a||!b?0:Math.max(1,Math.round((new Date(b).getTime()-new Date(a).getTime())/86400000));

export default function Home(){
  const [logged,setLogged]=useState(false);
  const [tab,setTab]=useState("dashboard");
  const [menuOpen,setMenuOpen]=useState(false);
  const [properties,setProperties]=useState<Property[]>([]);
  const [reservations,setReservations]=useState<Reservation[]>([]);
  const [cleanings,setCleanings]=useState<Cleaning[]>([]);
  const [expenses,setExpenses]=useState<Expense[]>([]);

  const [property,setProperty]=useState({name:"",type:"Apartamento",address:"",dailyRate:"",cleaningFee:"",guests:"2",wifi:"",password:"",ical:"",status:"Livre" });
  const [reservation,setReservation]=useState({propertyId:"",guest:"",checkIn:"",checkOut:"",value:"",source:"Manual"});
  const [expense,setExpense]=useState({propertyId:"",title:"",value:"",date:""});

  useEffect(()=>{setLogged(localStorage.getItem("lm_logged")==="true"); loadAll();},[]);

  async function loadAll(){
    const [p,r,c,e]=await Promise.all([
      supabase.from("properties").select("*").order("created_at",{ascending:false}),
      supabase.from("reservations").select("*").order("created_at",{ascending:false}),
      supabase.from("cleanings").select("*").order("created_at",{ascending:false}),
      supabase.from("expenses").select("*").order("created_at",{ascending:false}),
    ]);

    if(p.error||r.error||c.error||e.error){
      console.error(p.error||r.error||c.error||e.error);
      alert("Erro ao carregar dados do Supabase.");
      return;
    }

    setProperties((p.data||[]).map(x=>({
      id:x.id, name:x.name, type:x.type||"", address:x.address||"",
      dailyRate:Number(x.daily_rate||0), cleaningFee:Number(x.cleaning_fee||0),
      guests:Number(x.guests||1), wifi:x.wifi||"", password:x.password||"", ical:x.ical||"", status:x.status||"Livre",
    })));

    setReservations((r.data||[]).map(x=>({
      id:x.id, propertyId:x.property_id, guest:x.guest, checkIn:x.check_in||"",
      checkOut:x.check_out||"", value:Number(x.value||0), source:x.source||"Manual"
    })));

    setCleanings((c.data||[]).map(x=>({
      id:x.id, propertyId:x.property_id, date:x.date||"", status:x.status||"Pendente"
    })));

    setExpenses((e.data||[]).map(x=>({
      id:x.id, propertyId:x.property_id||"", title:x.title||"", value:Number(x.value||0), date:x.date||""
    })));
  }

  const revenue=reservations.reduce((s,r)=>s+r.value,0);
  const cost=expenses.reduce((s,e)=>s+e.value,0);
  const profit=revenue-cost;
  const pending=cleanings.filter(c=>c.status!=="Concluída").length;
const livres = properties.filter(p=>p.status==="Livre").length;
const ocupados = properties.filter(p=>p.status==="Ocupado").length;
const manutencao = properties.filter(p=>p.status==="Manutenção").length;
const financialData = [
  { nome:"Receita", valor: revenue },
  { nome:"Despesas", valor: cost },
  { nome:"Lucro", valor: profit }
];
  const occupancy=useMemo(()=>{
    const nights=reservations.reduce((s,r)=>s+days(r.checkIn,r.checkOut),0);
    return Math.min(100,Math.round((nights/Math.max(1,properties.length*30))*100));
  },[reservations,properties]);

  const propName=(id:string)=>properties.find(p=>p.id===id)?.name||"Imóvel removido";

  function login(){localStorage.setItem("lm_logged","true");setLogged(true)}
  function logout(){localStorage.removeItem("lm_logged");setLogged(false)}

  async function addProperty(){
    if(!property.name||!property.address)return alert("Preencha nome e endereço.");
    const {data,error}=await supabase.from("properties").insert({
      name:property.name,type:property.type,address:property.address,
      daily_rate:Number(property.dailyRate||0),cleaning_fee:Number(property.cleaningFee||0),
      guests:Number(property.guests||1),wifi:property.wifi,password:property.password,ical:property.ical,status:property.status
    }).select().single();

    if(error){console.error(error);return alert("Erro ao salvar propriedade.");}

    setProperties([{
      id:data.id,name:data.name,type:data.type||"",address:data.address||"",
      dailyRate:Number(data.daily_rate||0),cleaningFee:Number(data.cleaning_fee||0),
      guests:Number(data.guests||1),wifi:data.wifi||"",password:data.password||"",ical:data.ical||"",status:data.status||"livre"
    },...properties]);

    setProperty({name:"",type:"Apartamento",address:"",dailyRate:"",cleaningFee:"",guests:"2",wifi:"",password:"",ical:"",status:"livre"});
  }

  async function deleteProperty(id:string){
    if(!confirm("Excluir esta propriedade?"))return;
    const {error}=await supabase.from("properties").delete().eq("id",id);
    if(error)return alert("Erro ao excluir.");
    setProperties(properties.filter(p=>p.id!==id));
    setReservations(reservations.filter(r=>r.propertyId!==id));
    setCleanings(cleanings.filter(c=>c.propertyId!==id));
    setExpenses(expenses.filter(e=>e.propertyId!==id));
  }

  async function addReservation(){
    if(!reservation.propertyId||!reservation.guest||!reservation.checkIn||!reservation.checkOut)return alert("Preencha reserva.");
    const {data,error}=await supabase.from("reservations").insert({
      property_id:reservation.propertyId,guest:reservation.guest,check_in:reservation.checkIn,
      check_out:reservation.checkOut,value:Number(reservation.value||0),source:reservation.source
    }).select().single();

    if(error){console.error(error);return alert("Erro ao salvar reserva.");}

    const newRes={id:data.id,propertyId:data.property_id,guest:data.guest,checkIn:data.check_in,checkOut:data.check_out,value:Number(data.value||0),source:data.source};
    setReservations([newRes,...reservations]);

    const {data:cl}=await supabase.from("cleanings").insert({
      property_id:reservation.propertyId,date:reservation.checkOut,status:"Pendente"
    }).select().single();

    if(cl)setCleanings([{id:cl.id,propertyId:cl.property_id,date:cl.date,status:cl.status},...cleanings]);

    setReservation({propertyId:"",guest:"",checkIn:"",checkOut:"",value:"",source:"Manual"});
  }

  async function deleteReservation(id:string){
    const {error}=await supabase.from("reservations").delete().eq("id",id);
    if(error)return alert("Erro ao excluir.");
    setReservations(reservations.filter(r=>r.id!==id));
  }

  async function addExpense(){
    if(!expense.title||!expense.value)return alert("Preencha descrição e valor.");
    const {data,error}=await supabase.from("expenses").insert({
      property_id:expense.propertyId||null,title:expense.title,value:Number(expense.value||0),
      date:expense.date||new Date().toISOString().slice(0,10)
    }).select().single();

    if(error){console.error(error);return alert("Erro ao salvar despesa.");}

    setExpenses([{id:data.id,propertyId:data.property_id||"",title:data.title,value:Number(data.value||0),date:data.date},...expenses]);
    setExpense({propertyId:"",title:"",value:"",date:""});
  }

  async function deleteExpense(id:string){
    const {error}=await supabase.from("expenses").delete().eq("id",id);
    if(error)return alert("Erro ao excluir.");
    setExpenses(expenses.filter(e=>e.id!==id));
  }

  async function updateCleaning(id:string,status:Cleaning["status"]){
    const {error}=await supabase.from("cleanings").update({status}).eq("id",id);
    if(error)return alert("Erro ao atualizar limpeza.");
    setCleanings(cleanings.map(c=>c.id===id?{...c,status}:c));
  }

  async function deleteCleaning(id:string){
    const {error}=await supabase.from("cleanings").delete().eq("id",id);
    if(error)return alert("Erro ao excluir limpeza.");
    setCleanings(cleanings.filter(c=>c.id!==id));
  }

  async function mockAirbnbSync(){
    const p=properties.find(x=>x.ical);
    if(!p)return alert("Cadastre um link iCal primeiro.");
    const checkIn=new Date().toISOString().slice(0,10);
    const out=new Date(); out.setDate(out.getDate()+3);
    const checkOut=out.toISOString().slice(0,10);
    setReservation({propertyId:p.id,guest:"Reserva importada Airbnb",checkIn,checkOut,value:String(p.dailyRate*3+p.cleaningFee),source:"Airbnb iCal"});
    alert("Preenchi uma reserva simulada. Vá em Reservas e clique em Salvar reserva.");
  }

  async function clearAll(){
    if(!confirm("Apagar todos os dados?"))return;
    await supabase.from("expenses").delete().neq("id","00000000-0000-0000-0000-000000000000");
    await supabase.from("cleanings").delete().neq("id","00000000-0000-0000-0000-000000000000");
    await supabase.from("reservations").delete().neq("id","00000000-0000-0000-0000-000000000000");
    await supabase.from("properties").delete().neq("id","00000000-0000-0000-0000-000000000000");
    setProperties([]);setReservations([]);setCleanings([]);setExpenses([]);
  }

  if(!logged)return(
    <main className="min-h-screen bg-[#050816] text-white flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-[2rem] border border-white/10 bg-white/[0.06] p-8 shadow-2xl">
        <h1 className="text-4xl font-black">LMHOST IA</h1>
        <p className="text-blue-300 mb-8">LMHOST PRO</p>
        <Input label="Email" value="lucas@lmhost.com" onChange={()=>{}} />
        <div className="mt-4"><Input label="Senha" type="password" value="123456" onChange={()=>{}} /></div>
        <button onClick={login} className="mt-5 w-full rounded-2xl bg-blue-600 p-4 font-bold">Entrar</button>
      </div>
    </main>
  );

  return(
    <main className="min-h-screen bg-[#050816] text-white">
      <div className="flex min-h-screen">
        <aside className="hidden md:flex w-72 flex-col border-r border-white/10 bg-[#080D1F] p-6">
          <h1 className="text-2xl font-black">LMHOST IA</h1>
          <p className="text-sm text-blue-300 mb-8">Online Supabase</p>
          <nav className="space-y-2 flex-1">
            {[
              ["dashboard","Painel"],["properties","Propriedades"],["reservations","Reservas"],["calendar","Calendário"],
              ["cleaning","Limpeza"],["finance","Financeiro"],["airbnb","Airbnb iCal"],["pricing","Preços"],["guide","Guia"],["settings","Configurações"]
            ].map(([id,label])=>(
              <button key={id} onClick={()=>setTab(id)} className={`w-full rounded-2xl px-4 py-3 text-left text-sm font-semibold ${tab===id?"bg-blue-600":"text-white/65 hover:bg-white/10"}`}>
                {label}
              </button>
            ))}
          </nav>
          <button onClick={logout} className="rounded-2xl border border-white/10 px-4 py-3 text-sm">Sair</button>
        </aside>

        <section className="flex-1 p-5 md:p-10">
          <header className="mb-8 flex justify-between gap-4">
            <div>
              <h2 className="text-4xl font-black">LMHOST IA</h2>
              <p className="text-white/50">Gestao inteligente de hospedagens.</p>
            </div>
            <div className="h-fit rounded-full border border-blue-400/30 bg-blue-500/10 px-4 py-2 text-sm text-blue-200">Host 3.0</div>
          </header>
<div className="mb-6 md:hidden">
  <button
    onClick={() => setMenuOpen(!menuOpen)}
    className="flex w-full items-center justify-between rounded-2xl bg-blue-600 px-5 py-4 text-lg font-bold text-white"
  >
    <span>☰ Menu</span>
    <span>{menuOpen ? "▲" : "▼"}</span>
  </button>

  {menuOpen && (
    <div className="mt-3 grid grid-cols-2 gap-2">
      {[
        ["dashboard", "📊 Painel"],
["properties", "🏠 Propriedades"],
["reservations", "📅 Reservas"],
["calendar", "🗓️ Calendário"],
["cleaning", "🧹 Limpeza"],
["finance", "💰 Financeiro"],
["airbnb", "🔗 Airbnb iCal"],
["pricing", "⚡ Preços"],
["guide", "📖 Guia"],
["settings", "⚙️ Configurações"],
      ].map(([id, label]) => (
        <button
          key={id}
          onClick={() => {
            setTab(id as string);
            setMenuOpen(false);
          }}
          className={`rounded-2xl px-3 py-3 text-sm font-semibold ${
            tab === id
              ? "bg-blue-600 text-white"
              : "bg-white/10 text-white/70"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )}
</div>
          {tab==="dashboard"&&<>
            <Title title="Painel" desc="Visão geral."/>
            <div className="grid gap-4 md:grid-cols-4 lg:grid-cols-4">
              <Metric title="Imóveis" value={properties.length}/><Metric title="Reservas" value={reservations.length}/>
              <Metric title="Receita" value={money(revenue)}/><Metric title="Lucro" value={money(profit)}/><Box
  title={
    occupancy > 75
      ? "🟢 Ocupação"
      : occupancy >= 50
      ? "🟡 Ocupação"
      : "🔴 Ocupação"
  }
>
  <p className="text-4xl font-black">{occupancy}%</p>

  <div className="mt-4 h-3 rounded-full bg-white/10">
    <div
      className={`h-3 rounded-full ${
        occupancy > 75
          ? "bg-green-500"
          : occupancy >= 50
          ? "bg-yellow-400"
          : "bg-red-500"
      }`}
      style={{ width: `${Math.min(100, occupancy)}%` }}
    />
  </div>

  <p className="mt-3 text-sm text-white/50">
    {occupancy > 75
      ? "Excelente ocupação"
      : occupancy >= 50
      ? "Ocupação moderada"
      : "Ocupação baixa"}
  </p>
</Box>
<Metric title="🟢 Livres" value={livres}/>
<Metric title="🔴 Ocupados" value={ocupados}/>
<Metric title="🟡 Manutenção" value={manutencao}/>
<Metric title="🧹 Limpezas" value={pending}/>
            </div>
<Box title="📈 Resumo financeiro">
  <div className="grid gap-3 md:grid-cols-3">
    {financialData.map(item=>(
      <div key={item.nome} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
        <p className="text-sm text-white/60">{item.nome}</p>
        <p className="mt-1 text-2xl font-black">{money(item.valor)}</p>
        <div className="mt-3 h-2 rounded-full bg-white/10">
          <div
            className="h-2 rounded-full bg-blue-500"
            style={{width:`${Math.min(100, Math.max(8, Math.abs(item.valor)/(Math.max(1,revenue,cost,profit))*100))}%`}}
          />
        </div>
      </div>
    ))}
  </div>
</Box>
            <div className="mt-6 grid gap-5 md:grid-cols-2">
              <Box title="Próximas limpezas">{cleanings.length===0?<Empty text="Nenhuma limpeza."/>:cleanings.slice(0,5).map(c=><Row key={c.id} left={propName(c.propertyId)} right={`${c.date} • ${c.status}`}/>)}</Box>
              <Box title="Últimas reservas">{reservations.length===0?<Empty text="Nenhuma reserva."/>:reservations.slice(0,5).map(r=><Row key={r.id} left={`${r.guest} • ${propName(r.propertyId)}`} right={money(r.value)}/>)}</Box>
            </div>
          </>}

          {tab==="properties"&&<>
            <Title title="Propriedades" desc="Dados salvos online no Supabase."/>
            <Box title="Adicionar propriedade">
              <div className="grid gap-3 md:grid-cols-3">
                <Input label="Nome" value={property.name} onChange={v=>setProperty({...property,name:v})}/>
                <Select label="Tipo" value={property.type} onChange={v=>setProperty({...property,type:v})} options={["Apartamento","Casa","Studio","Galpão","Sala comercial"]}/>
                <Input label="Endereço" value={property.address} onChange={v=>setProperty({...property,address:v})}/>
                <Input label="Diária base" value={property.dailyRate} onChange={v=>setProperty({...property,dailyRate:v})}/>
                <Input label="Taxa limpeza" value={property.cleaningFee} onChange={v=>setProperty({...property,cleaningFee:v})}/>
                <Input label="Máx. hóspedes" value={property.guests} onChange={v=>setProperty({...property,guests:v})}/>
                <Input label="Wi-Fi" value={property.wifi} onChange={v=>setProperty({...property,wifi:v})}/>
                <Input label="Senha Wi-Fi" value={property.password} onChange={v=>setProperty({...property,password:v})}/>
                <Input label="Link iCal Airbnb" value={property.ical} onChange={v=>setProperty({...property,ical:v})}/>
                <Select
  label="Status"
  value={property.status}
  onChange={v=>setProperty({...property,status:v})}
  options={["Livre","Ocupado","Manutenção"]}
/>
              </div>
              <Button onClick={addProperty}>Salvar propriedade</Button>
            </Box>
            <div className="grid gap-4 md:grid-cols-2">{properties.length===0?<Empty text="Nenhuma propriedade."/>:properties.map(p=><Box key={p.id} title={p.name}>
              <p className="text-white/60">{p.type} • {p.address}</p>
              <p className="mt-1 text-sm text-blue-300">
 {p.status==="Livre"
 ? "🟢 Livre"
 : p.status==="Ocupado"
 ? "🔴 Ocupado"
 : "🟡 Manutenção"}
</p>
              <p className="mt-2 text-blue-300">Diária: {money(p.dailyRate)} • Limpeza: {money(p.cleaningFee)}</p>
              <button onClick={()=>deleteProperty(p.id)} className="mt-3 text-sm text-red-300">Excluir propriedade</button>
            </Box>)}</div>
          </>}

          {tab==="reservations"&&<>
            <Title title="Reservas" desc="Reservas salvas online."/>
            <Box title="Nova reserva">
              <div className="grid gap-3 md:grid-cols-3">
                <Select label="Imóvel" value={reservation.propertyId} onChange={v=>setReservation({...reservation,propertyId:v})} options={properties.map(p=>p.id)} labels={properties.map(p=>p.name)}/>
                <Input label="Hóspede" value={reservation.guest} onChange={v=>setReservation({...reservation,guest:v})}/>
                <Select label="Origem" value={reservation.source} onChange={v=>setReservation({...reservation,source:v})} options={["Manual","Airbnb","Booking","WhatsApp"]}/>
                <Input label="Check-in" type="date" value={reservation.checkIn} onChange={v=>setReservation({...reservation,checkIn:v})}/>
                <Input label="Check-out" type="date" value={reservation.checkOut} onChange={v=>setReservation({...reservation,checkOut:v})}/>
                <Input label="Valor total" value={reservation.value} onChange={v=>setReservation({...reservation,value:v})}/>
              </div>
              <Button onClick={addReservation}>Salvar reserva</Button>
            </Box>
            <Box title="Reservas cadastradas">{reservations.length===0?<Empty text="Nenhuma reserva."/>:reservations.map(r=><Line key={r.id} left={`${r.guest} • ${propName(r.propertyId)}`} right={`${r.checkIn} até ${r.checkOut} • ${money(r.value)}`} onDelete={()=>deleteReservation(r.id)}/>)}</Box>
          </>}

          {tab==="calendar"&&<><Title title="Calendário" desc="Check-ins e check-outs."/><Box title="Eventos">{reservations.length===0?<Empty text="Nenhum evento."/>:reservations.map(r=><Line key={r.id} left={`${r.checkIn} Check-in / ${r.checkOut} Check-out`} right={`${r.guest} • ${propName(r.propertyId)}`} onDelete={()=>deleteReservation(r.id)}/>)}</Box></>}

          {tab==="cleaning"&&<><Title title="Limpeza" desc="Controle pós check-out."/><Metric title="Limpezas pendentes" value={pending}/><div className="mt-5 grid gap-4 md:grid-cols-2">{cleanings.length===0?<Empty text="Nenhuma limpeza."/>:cleanings.map(c=><Box key={c.id} title={propName(c.propertyId)}>
            <p className="text-white/60">Data: {c.date}</p>
            <select className="mt-3 w-full rounded-2xl bg-[#101833] border border-white/10 p-3" value={c.status} onChange={e=>updateCleaning(c.id,e.target.value as Cleaning["status"])}>
              <option>Pendente</option><option>Em andamento</option><option>Concluída</option>
            </select>
            <button onClick={()=>deleteCleaning(c.id)} className="mt-3 text-sm text-red-300">Excluir limpeza</button>
          </Box>)}</div></>}

          {tab==="finance"&&<>
            <Title title="Financeiro" desc="Receitas, despesas e lucro."/>
            <div className="grid gap-4 md:grid-cols-3 mb-5"><Metric title="Receitas" value={money(revenue)}/><Metric title="Despesas" value={money(cost)}/><Metric title="Lucro" value={money(profit)}/></div>
            <Box title="Adicionar despesa">
              <div className="grid gap-3 md:grid-cols-4">
                <Select label="Imóvel" value={expense.propertyId} onChange={v=>setExpense({...expense,propertyId:v})} options={properties.map(p=>p.id)} labels={properties.map(p=>p.name)}/>
                <Input label="Descrição" value={expense.title} onChange={v=>setExpense({...expense,title:v})}/>
                <Input label="Valor" value={expense.value} onChange={v=>setExpense({...expense,value:v})}/>
                <Input label="Data" type="date" value={expense.date} onChange={v=>setExpense({...expense,date:v})}/>
              </div>
              <Button onClick={addExpense}>Salvar despesa</Button>
            </Box>
            <Box title="Despesas">{expenses.length===0?<Empty text="Nenhuma despesa."/>:expenses.map(e=><Line key={e.id} left={`${e.title} • ${propName(e.propertyId)}`} right={`${e.date} • ${money(e.value)}`} onDelete={()=>deleteExpense(e.id)}/>)}</Box>
          </>}

          {tab==="airbnb"&&<><Title title="Airbnb iCal" desc="Integração inicial."/><Box title="Sincronização"><p className="text-white/60">Por enquanto simula iCal. Próximo passo: importação real .ics.</p><Button onClick={mockAirbnbSync}>Simular sincronização</Button></Box></>}
          {tab==="pricing"&&<><Title title="Preços" desc="Sugestões simples."/><Box title="Sugestões">{properties.length===0?<Empty text="Cadastre imóvel."/>:properties.map(p=><Row key={p.id} left={p.name} right={`Semana ${money(p.dailyRate)} • FDS ${money(p.dailyRate*1.2)}`}/>)}</Box></>}
          {tab==="guide"&&<><Title title="Guia do Hóspede" desc="Modelo para QR Code."/><Box title="Guia">{properties.map(p=><Row key={p.id} left={p.name} right={`Wi-Fi: ${p.wifi||"não informado"} • Senha: ${p.password||"não informada"}`}/>)}</Box></>}
          {tab==="settings"&&<><Title title="Configurações" desc="Dados online."/><Box title="Banco"><p className="text-white/60">Agora os dados estão no Supabase.</p><Button onClick={clearAll}>Limpar tudo</Button></Box></>}
        </section>
      </div>
    </main>
  );
}

function Title({title,desc}:{title:string;desc:string}){return <div className="mb-5"><h2 className="text-3xl font-black capitalize">{title}</h2><p className="text-white/50">{desc}</p></div>}
function Metric({title,value}:{title:string;value:string|number}){return <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-4 shadow-xl"><p className="text-sm text-white/50">{title}</p><p className="mt-1 text-xl font-black">{value}</p></div>}
function Box({title,children}:{title:string;children:ReactNode}){return <div className="mb-5 rounded-3xl border border-white/10 bg-white/[0.06] p-5 shadow-2xl"><h3 className="mb-4 text-xl font-bold lowercase">{title}</h3>{children}</div>}
function Empty({text}:{text:string}){return <div className="rounded-2xl border border-dashed border-white/15 p-5 text-white/40">{text}</div>}
function Row({left,right}:{left:string;right:string}){return <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 border-b border-white/10 py-3 last:border-0"><span>{left}</span><span className="text-sm text-white/50">{right}</span></div>}
function Line({left,right,onDelete}:{left:string;right:string;onDelete:()=>void}){return <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 border-b border-white/10 py-3 last:border-0"><span>{left}</span><div className="flex gap-3"><span className="text-sm text-white/50">{right}</span><button onClick={onDelete} className="text-sm text-red-300">Excluir</button></div></div>}
function Input({label,value,onChange,type="text"}:{label:string;value:string;onChange:(v:string)=>void;type?:string}){return <label className="block"><span className="mb-1 block text-sm text-white/50">{label}</span><input type={type} value={value} onChange={e=>onChange(e.target.value)} className="w-full rounded-2xl border border-white/10 bg-[#101833] px-4 py-3 outline-none focus:border-blue-500"/></label>}
function Select({label,value,onChange,options,labels}:{label:string;value:string;onChange:(v:string)=>void;options:string[];labels?:string[]}){return <label className="block"><span className="mb-1 block text-sm text-white/50">{label}</span><select value={value} onChange={e=>onChange(e.target.value)} className="w-full rounded-2xl border border-white/10 bg-[#101833] px-4 py-3 outline-none focus:border-blue-500"><option value="">Selecione</option>{options.map((o,i)=><option key={o} value={o}>{labels?.[i]||o}</option>)}</select></label>}
function Button({children,onClick}:{children:ReactNode;onClick:()=>void}){return <button onClick={onClick} className="mt-4 rounded-2xl bg-blue-600 px-6 py-3 font-bold text-white shadow-lg shadow-blue-600/20 hover:bg-blue-500">{children}</button>}