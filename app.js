const firebaseConfig = {
  apiKey: "AIzaSyB3xUlT0Oue5B_yc44ZphiXNesjQ5CtEz8",
  authDomain: "app-cable-next.firebaseapp.com",
  projectId: "app-cable-next",
  storageBucket: "app-cable-next.firebasestorage.app",
  messagingSenderId: "1084922439923",
  appId: "1:1084922439923:web:518b19750cd871256daf86",
  measurementId: "G-YBGS8LOL10"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const usuariosRef = db.collection('usuarios');
const ordenesRef = db.collection('ordenes');
const materialesRef = db.collection('materiales');
const bodegaPrincipalRef = db.collection('bodegaPrincipal');
const bodegasTecnicosRef = db.collection('bodegasTecnicos');
const movimientosInventarioRef = db.collection('movimientosInventario');

const campos=['fecha','hora','orden','tecnico','cedula','cliente','telefono','direccion','zona','tipo','estado','resultado','serial','mac','potencia','puerto','cto','puertoCto','fibra','gps','observaciones'];
let ordenes=[];
let materiales=[];
let bodegaPrincipal=[];
let bodegasTecnicos=[];
let movimientosInventario=[];
let usuarios=[];
let session=null;
let unsubscribeOrdenes=null;
let unsubscribeInventario=[];
let fotoActual='', firmaActual='';
const $=id=>document.getElementById(id);

function normRol(rol){
  const r=String(rol||'').toLowerCase();
  if(r.includes('admin')) return 'Administrador';
  if(r.includes('super')) return 'Supervisor';
  return 'Técnico';
}
function showViews(){
  $('loginView').classList.toggle('hidden',!!session);
  $('btnSalir').classList.toggle('hidden',!session);
  $('tecnicoView').classList.add('hidden');$('supervisorView').classList.add('hidden');
  $('usuarioLabel').textContent=session?`${session.user} · ${session.rol}`:'';
  if(!session)return;
  if(session.rol==='Técnico')$('tecnicoView').classList.remove('hidden');
  else $('supervisorView').classList.remove('hidden');
  render();
}
function setBusy(b){ $('btnLogin').disabled=!!b; $('btnLogin').textContent=b?'Entrando...':'Entrar'; }
async function login(){
  const email=$('loginEmail').value.trim().toLowerCase();
  const pass=$('loginPassword').value;
  if(!email||!pass){alert('Digite correo y contraseña');return}
  try{ setBusy(true); await auth.signInWithEmailAndPassword(email,pass); }
  catch(e){ alert('No se pudo ingresar: '+(e.message||e.code)); }
  finally{ setBusy(false); }
}
async function salir(){ await auth.signOut(); }
async function cargarPerfil(user){
  const email=(user.email||'').toLowerCase();
  const doc=await usuariosRef.doc(email).get();
  if(!doc.exists){
    alert('Este correo no tiene rol en Firestore. Cree un documento en usuarios con ID: '+email);
    await auth.signOut(); return;
  }
  const data=doc.data()||{};
  if(data.activo===false){ alert('Usuario inactivo.'); await auth.signOut(); return; }
  session={email,user:data.nombre||email,rol:normRol(data.rol)};
  escucharOrdenes();
  escucharInventario();
  showViews();
}
function escucharOrdenes(){
  if(unsubscribeOrdenes) unsubscribeOrdenes();
  unsubscribeOrdenes=ordenesRef.onSnapshot(snap=>{
    ordenes=snap.docs.map(d=>({id:d.id,...d.data()}));
    render();
  },err=>alert('Error leyendo Firestore: '+err.message));
}

function escucharInventario(){
  unsubscribeInventario.forEach(fn=>fn&&fn());
  unsubscribeInventario=[];
  unsubscribeInventario.push(materialesRef.onSnapshot(snap=>{materiales=snap.docs.map(d=>({id:d.id,...d.data()}));renderInventario();}));
  unsubscribeInventario.push(bodegaPrincipalRef.onSnapshot(snap=>{bodegaPrincipal=snap.docs.map(d=>({id:d.id,...d.data()}));renderInventario();}));
  unsubscribeInventario.push(bodegasTecnicosRef.onSnapshot(snap=>{bodegasTecnicos=snap.docs.map(d=>({id:d.id,...d.data()}));renderInventario();}));
  unsubscribeInventario.push(movimientosInventarioRef.orderBy('fecha','desc').limit(50).onSnapshot(snap=>{movimientosInventario=snap.docs.map(d=>({id:d.id,...d.data()}));renderInventario();}));
  unsubscribeInventario.push(usuariosRef.onSnapshot(snap=>{usuarios=snap.docs.map(d=>({id:d.id,...d.data()}));renderInventario();}));
}
function numero(v){return Number(v||0)||0}
function dineroId(v){return encodeURIComponent(String(v||'').trim())}
function esc(v){return String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
function materialPorId(id){return materiales.find(m=>m.id===id)||materiales.find(m=>m.codigo===id)||{} }
function stockPrincipal(id){const s=bodegaPrincipal.find(b=>b.materialId===id||b.id===id);return numero(s?.cantidad)}
function esTecnico(u){return normRol(u.rol)==='Técnico'}
function renderInventario(){
  if(!session) return;
  renderMiBodega();
  if(session.rol==='Técnico') return;
  cargarSelectTecnicosInventario();
  cargarSelectMaterialesInventario();
  renderBodegaPrincipal();
  renderBodegasTecnicos();
  renderMovimientos();
}
function cargarSelectTecnicosInventario(){
  const sel=$('entregaTecnico'); if(!sel) return;
  const actual=sel.value;
  const lista=usuarios.filter(esTecnico).sort((a,b)=>String(a.nombre||a.id).localeCompare(String(b.nombre||b.id)));
  sel.innerHTML='<option value="">Seleccione técnico...</option>'+lista.map(u=>`<option value="${esc(u.id)}">${esc(u.nombre||u.id)} (${esc(u.id)})</option>`).join('');
  sel.value=actual;
}
function cargarSelectMaterialesInventario(){
  const sel=$('entregaMaterial'); if(!sel) return;
  const actual=sel.value;
  const lista=[...materiales].sort((a,b)=>String(a.nombre||a.id).localeCompare(String(b.nombre||b.id)));
  sel.innerHTML='<option value="">Seleccione material...</option>'+lista.map(m=>`<option value="${esc(m.id)}">${esc(m.codigo||m.id)} - ${esc(m.nombre||'')}</option>`).join('');
  sel.value=actual;
}
function renderBodegaPrincipal(){
  const tb=$('tablaBodegaPrincipal'); if(!tb) return;
  const lista=[...materiales].sort((a,b)=>String(a.nombre||a.id).localeCompare(String(b.nombre||b.id)));
  tb.innerHTML=lista.length?lista.map(m=>{
    const cant=stockPrincipal(m.id), min=numero(m.stockMinimo), bajo=cant<=min;
    return `<tr><td>${esc(m.codigo||m.id)}</td><td>${esc(m.nombre)}</td><td>${esc(m.unidad)}</td><td><strong>${cant}</strong></td><td>${min}</td><td><span class="badge ${bajo?'Cancelado':'Instalado'}">${bajo?'Bajo':'OK'}</span></td></tr>`;
  }).join(''):'<tr><td colspan="6">Sin materiales registrados</td></tr>';
}
function renderBodegasTecnicos(){
  const tb=$('tablaBodegasTecnicos'); if(!tb) return;
  const lista=[...bodegasTecnicos].filter(x=>numero(x.cantidad)>0).sort((a,b)=>String(a.tecnicoNombre||'').localeCompare(String(b.tecnicoNombre||'')));
  tb.innerHTML=lista.length?lista.map(x=>`<tr><td>${esc(x.tecnicoNombre||x.tecnicoEmail)}</td><td>${esc(x.codigo||x.materialId)}</td><td>${esc(x.nombre)}</td><td>${esc(x.unidad)}</td><td><strong>${numero(x.cantidad)}</strong></td></tr>`).join(''):'<tr><td colspan="5">Sin material entregado a técnicos</td></tr>';
}
function renderMiBodega(){
  const tb=$('tablaMiBodega'); if(!tb||!session) return;
  const lista=bodegasTecnicos.filter(x=>x.tecnicoEmail===session.email&&numero(x.cantidad)>0).sort((a,b)=>String(a.nombre||'').localeCompare(String(b.nombre||'')));
  tb.innerHTML=lista.length?lista.map(x=>`<tr><td>${esc(x.codigo||x.materialId)}</td><td>${esc(x.nombre)}</td><td>${esc(x.unidad)}</td><td><strong>${numero(x.cantidad)}</strong></td></tr>`).join(''):'<tr><td colspan="4">No tienes material asignado</td></tr>';
}
function renderMovimientos(){
  const tb=$('tablaMovimientos'); if(!tb) return;
  tb.innerHTML=movimientosInventario.length?movimientosInventario.map(m=>`<tr><td>${esc(m.fechaTexto||'')}</td><td>${esc(m.tipo)}</td><td>${esc(m.nombre||m.materialId)}</td><td>${numero(m.cantidad)}</td><td>${esc(m.origen)}</td><td>${esc(m.destino)}</td><td>${esc(m.usuarioNombre||m.usuarioEmail)}</td></tr>`).join(''):'<tr><td colspan="7">Sin movimientos</td></tr>';
}
async function guardarMaterialInventario(e){
  e.preventDefault();
  if(!session || session.rol==='Técnico'){alert('Solo administrador o supervisor puede cargar material');return}
  const codigo=$('matCodigo').value.trim().toUpperCase();
  const nombre=$('matNombre').value.trim();
  const unidad=$('matUnidad').value;
  const stockMinimo=numero($('matMinimo').value);
  const cantidad=numero($('matCantidad').value);
  if(!codigo||!nombre){alert('Digite código y nombre del material');return}
  if(cantidad<0){alert('La cantidad no puede ser negativa');return}
  const id=dineroId(codigo);
  try{
    await db.runTransaction(async tx=>{
      const matRef=materialesRef.doc(id), bodRef=bodegaPrincipalRef.doc(id);
      const bodSnap=await tx.get(bodRef);
      const actual=numero(bodSnap.data()?.cantidad);
      tx.set(matRef,{codigo,nombre,unidad,stockMinimo,activo:true,actualizado:new Date().toISOString()},{merge:true});
      tx.set(bodRef,{materialId:id,codigo,nombre,unidad,cantidad:actual+cantidad,stockMinimo,actualizado:new Date().toISOString()},{merge:true});
      if(cantidad>0){
        const movRef=movimientosInventarioRef.doc();
        tx.set(movRef,{tipo:'Carga bodega principal',materialId:id,codigo,nombre,unidad,cantidad,origen:'Compra / ingreso',destino:'Bodega principal',fecha:firebase.firestore.FieldValue.serverTimestamp(),fechaTexto:new Date().toLocaleString(),usuarioEmail:session.email,usuarioNombre:session.user});
      }
    });
    $('materialForm').reset();$('matMinimo').value=0;$('matCantidad').value=0;
    alert('Material guardado correctamente');
  }catch(err){alert('No se pudo guardar material: '+err.message)}
}
async function entregarMaterialTecnico(e){
  e.preventDefault();
  if(!session || session.rol==='Técnico'){alert('Solo administrador o supervisor puede entregar material');return}
  const tecnicoEmail=$('entregaTecnico').value;
  const materialId=$('entregaMaterial').value;
  const cantidad=numero($('entregaCantidad').value);
  if(!tecnicoEmail||!materialId||cantidad<=0){alert('Seleccione técnico, material y cantidad');return}
  const tecnico=usuarios.find(u=>u.id===tecnicoEmail)||{};
  const mat=materialPorId(materialId);
  const docId=dineroId(tecnicoEmail+'__'+materialId);
  try{
    await db.runTransaction(async tx=>{
      const principalRef=bodegaPrincipalRef.doc(materialId);
      const tecnicoRef=bodegasTecnicosRef.doc(docId);
      const principalSnap=await tx.get(principalRef);
      const tecnicoSnap=await tx.get(tecnicoRef);
      const disponible=numero(principalSnap.data()?.cantidad);
      if(disponible<cantidad) throw new Error('No hay suficiente material en bodega principal. Disponible: '+disponible);
      const actualTecnico=numero(tecnicoSnap.data()?.cantidad);
      tx.set(principalRef,{cantidad:disponible-cantidad,actualizado:new Date().toISOString()},{merge:true});
      tx.set(tecnicoRef,{tecnicoEmail,tecnicoNombre:tecnico.nombre||tecnicoEmail,materialId,codigo:mat.codigo||materialId,nombre:mat.nombre||'',unidad:mat.unidad||'',cantidad:actualTecnico+cantidad,actualizado:new Date().toISOString()},{merge:true});
      tx.set(movimientosInventarioRef.doc(),{tipo:'Entrega a técnico',materialId,codigo:mat.codigo||materialId,nombre:mat.nombre||'',unidad:mat.unidad||'',cantidad,origen:'Bodega principal',destino:tecnico.nombre||tecnicoEmail,fecha:firebase.firestore.FieldValue.serverTimestamp(),fechaTexto:new Date().toLocaleString(),usuarioEmail:session.email,usuarioNombre:session.user});
    });
    $('entregaForm').reset();
    alert('Material entregado correctamente');
  }catch(err){alert('No se pudo entregar material: '+err.message)}
}

function ordenAuto(){
  const d=new Date();const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0');
  return `FTTH-${y}${m}${day}-${String(ordenes.length+1).padStart(4,'0')}`;
}
function crearOrdenRapida(){const ced=$('cedulaRapida').value.trim();if(!ced){alert('Digite la cédula');return}limpiarForm();$('formSection').classList.remove('hidden');$('orden').value=ordenAuto();$('fecha').valueAsDate=new Date();$('tecnico').value=session.user;$('cedula').value=ced;$('estado').value='En proceso';$('resultado').value='Sin cerrar';}
function limpiarForm(){document.getElementById('ordenForm').reset();$('editId').value='';fotoActual='';firmaActual='';$('fotoPreview').innerHTML='';limpiarFirma()}
function leerForm(){const d={};campos.forEach(c=>d[c]=$(c).value.trim());d.foto=fotoActual;d.firma=obtenerFirma();d.actualizado=new Date().toISOString();d.creadoPorEmail=session?.email||'';d.tecnicoEmail=session?.rol==='Técnico'?session.email:(d.tecnicoEmail||'');return d}
async function guardarOrden(e){
  e.preventDefault();
  const d=leerForm();
  if(!d.tipo){alert('Seleccione tipo de instalación');return}
  try{
    if($('editId').value){
      await ordenesRef.doc($('editId').value).set({...d},{merge:true});
    }else{
      d.creado=new Date().toISOString();
      await ordenesRef.add(d);
    }
    $('formSection').classList.add('hidden');$('cedulaRapida').value='';limpiarForm();
  }catch(e){alert('No se pudo guardar: '+e.message)}
}
function puedeEditar(r){return session && (session.rol!=='Técnico' || r.tecnicoEmail===session.email || r.tecnico===session.user)}
function editar(id){const r=ordenes.find(o=>o.id===id);if(!r)return;if(!puedeEditar(r)){alert('No puede editar esta orden');return}$('formSection').classList.remove('hidden');campos.forEach(c=>$(c).value=r[c]||'');$('editId').value=r.id;fotoActual=r.foto||'';firmaActual=r.firma||'';$('fotoPreview').innerHTML=fotoActual?`<img src="${fotoActual}">`:'';cargarFirma(firmaActual);window.scrollTo({top:0,behavior:'smooth'})}
async function borrar(id){if(session?.rol==='Técnico'){alert('Solo supervisor o administrador puede borrar');return}if(!confirm('¿Borrar orden?'))return;try{await ordenesRef.doc(id).delete()}catch(e){alert('No se pudo borrar: '+e.message)}}
function cls(e){return(e||'').replaceAll(' ','-')}
function misOrdenes(){return ordenes.filter(o=>o.tecnicoEmail===session.email || o.tecnico===session.user)}
function filtroOrdenes(){
 const q=($('buscar')?.value||'').toLowerCase(), desde=$('desde')?.value||'', hasta=$('hasta')?.value||'', estado=$('filtroEstado')?.value||'', tipo=$('filtroTipo')?.value||'';
 return ordenes.filter(r=>{
  const txt=`${r.orden} ${r.tecnico} ${r.cedula} ${r.cliente} ${r.direccion}`.toLowerCase();
  return (!q||txt.includes(q))&&(!desde||r.fecha>=desde)&&(!hasta||r.fecha<=hasta)&&(!estado||r.estado===estado)&&(!tipo||r.tipo===tipo)
 }).sort((a,b)=>(b.fecha||'').localeCompare(a.fecha||''));
}
function renderTecnico(){
 const data=misOrdenes();
 $('tablaTecnico').innerHTML=data.length?data.map(r=>`<tr><td>${r.fecha||''}</td><td>${r.orden||''}</td><td>${r.cedula||''}</td><td>${r.tipo||''}</td><td><span class="badge ${cls(r.estado)}">${r.estado||''}</span></td><td><div class="row-actions"><button onclick="ver('${r.id}')">Ver</button><button onclick="editar('${r.id}')">Editar</button></div></td></tr>`).join(''):'<tr><td colspan="6">Sin órdenes</td></tr>';
}
function renderSupervisor(){
 const data=filtroOrdenes();
 $('tablaSupervisor').innerHTML=data.length?data.map(r=>`<tr><td>${r.fecha||''}</td><td>${r.orden||''}</td><td>${r.tecnico||''}</td><td>${r.cedula||''}</td><td>${r.cliente||''}</td><td>${r.tipo||''}</td><td><span class="badge ${cls(r.estado)}">${r.estado||''}</span></td><td>${r.foto?'📷 ':''}${r.firma?'✍️':''}</td><td><div class="row-actions"><button onclick="ver('${r.id}')">Ver</button><button class="danger" onclick="borrar('${r.id}')">Borrar</button></div></td></tr>`).join(''):'<tr><td colspan="9">Sin órdenes</td></tr>';
 $('total').textContent=ordenes.length;$('instaladas').textContent=ordenes.filter(o=>o.estado==='Instalado').length;$('proceso').textContent=ordenes.filter(o=>o.estado==='En proceso').length;$('novedades').textContent=ordenes.filter(o=>o.estado==='Con novedad').length;$('canceladas').textContent=ordenes.filter(o=>o.estado==='Cancelado').length;
 resumen();
}
function contar(campo){const out={};ordenes.forEach(o=>{const k=o[campo]||'Sin dato';out[k]=(out[k]||0)+1});return out}
function resumen(){const tec=contar('tecnico');$('resumenTecnicos').innerHTML=Object.entries(tec).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`<div><strong>${v}</strong>${k}</div>`).join('')||'<div>Sin datos</div>';const tipos=contar('tipo');const base=['FTTH Multipmexada','FTTH Overload','FTTH TV','Derivación'];$('resumenTipos').innerHTML=base.map(t=>`<div><strong>${tipos[t]||0}</strong>${t}</div>`).join('')}
function render(){if(!session)return;if(session.rol==='Técnico')renderTecnico();else renderSupervisor();renderInventario()}
function tomarGPS(){navigator.geolocation?navigator.geolocation.getCurrentPosition(p=>{$('gps').value=p.coords.latitude.toFixed(6)+', '+p.coords.longitude.toFixed(6)},()=>alert('No se pudo tomar GPS')):alert('GPS no disponible')}
function foto(file){const reader=new FileReader();reader.onload=e=>{const img=new Image();img.onload=()=>{const c=document.createElement('canvas');let w=img.width,h=img.height,max=700;if(w>h&&w>max){h*=max/w;w=max}else if(h>max){w*=max/h;h=max}c.width=w;c.height=h;c.getContext('2d').drawImage(img,0,0,w,h);fotoActual=c.toDataURL('image/jpeg',0.55);$('fotoPreview').innerHTML=`<img src="${fotoActual}">`};img.src=e.target.result};reader.readAsDataURL(file)}
const canvas=$('firmaCanvas'),ctx=canvas.getContext('2d');let draw=false;
function pos(e){const r=canvas.getBoundingClientRect(),p=e.touches?e.touches[0]:e;return{x:(p.clientX-r.left)*(canvas.width/r.width),y:(p.clientY-r.top)*(canvas.height/r.height)}}
function start(e){draw=true;const p=pos(e);ctx.beginPath();ctx.moveTo(p.x,p.y);e.preventDefault()}
function move(e){if(!draw)return;const p=pos(e);ctx.lineTo(p.x,p.y);ctx.lineWidth=2;ctx.lineCap='round';ctx.stroke();e.preventDefault()}
function end(){draw=false}
function limpiarFirma(){ctx.clearRect(0,0,canvas.width,canvas.height)}
function obtenerFirma(){return canvas.toDataURL('image/png')}
function cargarFirma(data){limpiarFirma();if(!data)return;const img=new Image();img.onload=()=>ctx.drawImage(img,0,0,canvas.width,canvas.height);img.src=data}
function ver(id){const r=ordenes.find(o=>o.id===id);if(!r)return;$('detalleOrden').innerHTML=`<h2>Orden ${r.orden}</h2><div class="detail-grid">${campos.map(c=>`<div><strong>${c}</strong><br>${r[c]||''}</div>`).join('')}</div><h3>Evidencias</h3>${r.foto?`<p>Foto</p><img class="report-img" src="${r.foto}">`:''}${r.firma?`<p>Firma</p><img class="report-img" src="${r.firma}">`:''}<div class="actions"><button onclick="window.print()">Imprimir</button></div>`;$('modal').classList.remove('hidden')}
function descargar(contenido,nombre,tipo){const b=new Blob([contenido],{type:tipo});const u=URL.createObjectURL(b),a=document.createElement('a');a.href=u;a.download=nombre;a.click();URL.revokeObjectURL(u)}
function limpiarTexto(v){return String(v||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}
function excel(){
 const headers=[['fecha','Fecha'],['hora','Hora'],['orden','Orden'],['tecnico','Técnico'],['cedula','Cédula'],['cliente','Cliente'],['telefono','Teléfono'],['direccion','Dirección'],['zona','Zona'],['tipo','Tipo instalación'],['estado','Estado'],['resultado','Resultado técnico'],['serial','Serial ONU'],['mac','MAC'],['potencia','Potencia RX'],['puerto','Puerto OLT/PON'],['cto','CTO/Caja'],['puertoCto','Puerto CTO'],['fibra','Metros fibra'],['gps','GPS'],['observaciones','Observaciones'],['foto','Tiene foto'],['firma','Tiene firma']];
 const data=filtroOrdenes();let html='<html><head><meta charset="UTF-8"></head><body><table border="1"><thead><tr>';headers.forEach(h=>html+=`<th>${h[1]}</th>`);html+='</tr></thead><tbody>';data.forEach(r=>{html+='<tr>';headers.forEach(([key])=>{let val='';if(key==='foto') val=r.foto?'Sí':'No';else if(key==='firma') val=r.firma?'Sí':'No';else val=r[key]||'';html+=`<td>${limpiarTexto(val)}</td>`});html+='</tr>'});html+='</tbody></table></body></html>';descargar(html,'reporte_ftth_empresa.xls','application/vnd.ms-excel;charset=utf-8;')
}
function backup(){descargar(JSON.stringify(ordenes,null,2),'respaldo_ftth_empresa.json','application/json')}
async function importar(file){const rd=new FileReader();rd.onload=async e=>{try{const data=JSON.parse(e.target.result);if(!Array.isArray(data))throw new Error();const batch=db.batch();data.forEach(o=>{const id=o.id||ordenesRef.doc().id;const ref=ordenesRef.doc(id);delete o.id;batch.set(ref,o,{merge:true})});await batch.commit();alert('Importado correctamente')}catch{alert('Archivo inválido')}};rd.readAsText(file)}
$('btnLogin').onclick=login;$('btnSalir').onclick=salir;$('btnCrearOrden').onclick=crearOrdenRapida;$('ordenForm').onsubmit=guardarOrden;$('btnCancelar').onclick=()=>{$('formSection').classList.add('hidden');limpiarForm()};$('btnGPS').onclick=tomarGPS;$('fotoInput').onchange=e=>{if(e.target.files[0])foto(e.target.files[0])};$('btnLimpiarFirma').onclick=limpiarFirma;$('cerrarModal').onclick=()=>$('modal').classList.add('hidden');
['mousedown','touchstart'].forEach(ev=>canvas.addEventListener(ev,start));['mousemove','touchmove'].forEach(ev=>canvas.addEventListener(ev,move));['mouseup','mouseleave','touchend'].forEach(ev=>canvas.addEventListener(ev,end));
['buscar','desde','hasta','filtroEstado','filtroTipo'].forEach(id=>$(id)?.addEventListener('input',render));
$('btnExcel')?.addEventListener('click',excel);$('btnBackup')?.addEventListener('click',backup);$('importJson')?.addEventListener('change',e=>{if(e.target.files[0])importar(e.target.files[0])});
$('materialForm')?.addEventListener('submit',guardarMaterialInventario);$('entregaForm')?.addEventListener('submit',entregarMaterialTecnico);
auth.onAuthStateChanged(user=>{ if(user) cargarPerfil(user); else {session=null; ordenes=[]; if(unsubscribeOrdenes) unsubscribeOrdenes(); unsubscribeInventario.forEach(fn=>fn&&fn()); unsubscribeInventario=[]; materiales=[]; bodegaPrincipal=[]; bodegasTecnicos=[]; movimientosInventario=[]; usuarios=[]; showViews();} });
