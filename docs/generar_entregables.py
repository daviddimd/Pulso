"""Genera los entregables de revisión de Pulso desde metadatos sin registros.

Requiere Python, reportlab y el archivo .runtime/schema-ti-v2.json generado mediante
la consulta de INFORMATION_SCHEMA. No lee usuarios, servicios ni contraseñas.
"""
from pathlib import Path
import json, re, math, textwrap, zipfile, hashlib, shutil
from xml.etree import ElementTree as ET
from xml.sax.saxutils import escape
from reportlab.pdfgen import canvas
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, A3, landscape
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'output/entrega-ti-2026-11-10/pdf'; SRC=ROOT/'docs/entrega-ti-2026-11-10'
OUT.mkdir(parents=True,exist_ok=True); SRC.mkdir(parents=True,exist_ok=True)
SCHEMA=json.loads((ROOT/'.runtime/schema-ti-v2.json').read_text(encoding='utf-8'))
DATE='10 de noviembre de 2026'; INK='#193c46'; TEAL='#245966'; PALE='#eef4f4'; MUTED='#52666d'
for name,file in [('Pulso','arial.ttf'),('Pulso-Bold','arialbd.ttf')]:
    pdfmetrics.registerFont(TTFont(name,str(Path('C:/Windows/Fonts')/file)))
styles=getSampleStyleSheet()
for s in styles.byName.values(): s.fontName='Pulso'
styles['Title'].fontName='Pulso-Bold'; styles['Title'].fontSize=25; styles['Title'].leading=30; styles['Title'].textColor=colors.HexColor(INK)
styles['Heading1'].fontName='Pulso-Bold'; styles['Heading1'].fontSize=17; styles['Heading1'].leading=22; styles['Heading1'].textColor=colors.HexColor(INK)
styles['Heading2'].fontName='Pulso-Bold'; styles['Heading2'].fontSize=12; styles['Heading2'].leading=16
styles['Heading1'].keepWithNext=True
styles['Heading2'].keepWithNext=True
styles.add(ParagraphStyle(name='TableSection',parent=styles['Heading1'],keepWithNext=False))
styles['BodyText'].fontSize=10; styles['BodyText'].leading=14; styles['BodyText'].spaceAfter=7
styles.add(ParagraphStyle(name='SmallPulso',fontName='Pulso',fontSize=8,leading=11,spaceAfter=5))
styles.add(ParagraphStyle(name='CellPulso',fontName='Pulso',fontSize=8,leading=11))

def p(text,style='BodyText'): return Paragraph(escape(str(text)),styles[style])
def header(c,d):
    w,h=d.pagesize; c.setFont('Pulso',8); c.setFillColor(colors.HexColor(MUTED))
    c.drawString(38,h-24,'PULSO / Oficina de Movilización / Revisión técnica')
    c.drawRightString(w-38,23,f'{DATE}  |  {d.page}')
def document(name,title,items):
    doc=SimpleDocTemplate(str(OUT/name),pagesize=A4,rightMargin=40,leftMargin=40,topMargin=48,bottomMargin=43)
    doc.build([p(title,'Title'),p('Versión 2.0 / Revisión del MER al 10-11-2026','SmallPulso'),Spacer(1,12)]+items,onFirstPage=header,onLaterPages=header)
def table(rows,widths):
    t=Table([[p(x,'CellPulso') for x in row] for row in rows],colWidths=widths,repeatRows=1,hAlign='LEFT')
    t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),colors.HexColor(TEAL)),('TEXTCOLOR',(0,0),(-1,0),colors.white),('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),7),('RIGHTPADDING',(0,0),(-1,-1),7),('TOPPADDING',(0,0),(-1,-1),7),('BOTTOMPADDING',(0,0),(-1,-1),7),('ROWBACKGROUNDS',(0,1),(-1,-1),[colors.white,colors.HexColor(PALE)]),('LINEBELOW',(0,0),(-1,0),.6,colors.HexColor(TEAL))]))
    # Paragraph colors are explicit because a table's TEXTCOLOR does not affect them.
    for item in t._cellvalues[0]: item.style=ParagraphStyle(name='TableHead',parent=styles['CellPulso'],textColor=colors.white,fontName='Pulso-Bold')
    return t
def markdown(name,title,sections):
    (SRC/name).write_text('# '+title+'\n\nFecha: 2026-11-10. Versión 2.0.\n\n'+'\n\n'.join('## '+h+'\n\n'+body for h,body in sections)+'\n',encoding='utf-8')

class Diagram:
    """Mismos elementos vectoriales para PDF y SVG; coordenadas superiores."""
    def __init__(self,w=1100,h=600): self.w=w; self.h=h; self.commands=[]
    def rect(self,x,y,w,h,fill='white',stroke=TEAL,r=0): self.commands.append(('rect',x,y,w,h,fill,stroke,r))
    def ellipse(self,x,y,w,h,fill='white',stroke=TEAL): self.commands.append(('ellipse',x,y,w,h,fill,stroke))
    def line(self,pts,arrow=False,dash=False,color=TEAL): self.commands.append(('line',pts,arrow,dash,color))
    def text(self,x,y,label,size=11,bold=False,anchor='middle',color=INK): self.commands.append(('text',x,y,label,size,bold,anchor,color))
    def polygon(self,pts,fill='white',stroke=TEAL): self.commands.append(('polygon',pts,fill,stroke))
    def render(self,c,dx=0,dy=0,scale=1):
        c.saveState(); c.translate(dx,dy); c.scale(scale,scale)
        for q in self.commands:
            if q[0] in ('rect','ellipse'):
                kind,x,y,w,h,fill,stroke,*rest=q
                c.setFillColor(colors.toColor(fill));c.setStrokeColor(colors.toColor(stroke));c.setLineWidth(1)
                if kind=='rect': c.roundRect(x,self.h-y-h,w,h,rest[0],stroke=1,fill=1)
                else: c.ellipse(x,self.h-y-h,x+w,self.h-y,stroke=1,fill=1)
            elif q[0]=='polygon':
                _,pts,fill,stroke=q; c.setFillColor(colors.toColor(fill));c.setStrokeColor(colors.toColor(stroke))
                path=c.beginPath();path.moveTo(pts[0][0],self.h-pts[0][1])
                for x,y in pts[1:]:path.lineTo(x,self.h-y)
                path.close();c.drawPath(path,stroke=1,fill=1)
            elif q[0]=='line':
                _,pts,arrow,dash,col=q; c.setStrokeColor(colors.HexColor(col));c.setLineWidth(1);c.setDash(4,3) if dash else c.setDash()
                path=c.beginPath();path.moveTo(pts[0][0],self.h-pts[0][1])
                for x,y in pts[1:]:path.lineTo(x,self.h-y)
                c.drawPath(path);c.setDash()
                if arrow:
                    a,b=pts[-2:]; ang=math.atan2(b[1]-a[1],b[0]-a[0]); tip=[]
                    for sign in [-1,1]:tip.append((b[0]-8*math.cos(ang+sign*.4),b[1]-8*math.sin(ang+sign*.4)))
                    c.line(tip[0][0],self.h-tip[0][1],b[0],self.h-b[1]);c.line(tip[1][0],self.h-tip[1][1],b[0],self.h-b[1])
            else:
                _,x,y,label,size,bold,anchor,col=q;c.setFillColor(colors.HexColor(col));c.setFont('Pulso-Bold' if bold else 'Pulso',size)
                lines=label.split('\n')
                for i,line in enumerate(lines):
                    yy=self.h-y-i*size*1.25
                    {'middle':c.drawCentredString,'start':c.drawString,'end':c.drawRightString}[anchor](x,yy,line)
        c.restoreState()
    def svg(self,path):
        parts=[f'<svg xmlns="http://www.w3.org/2000/svg" width="{self.w}" height="{self.h}" viewBox="0 0 {self.w} {self.h}"><rect width="100%" height="100%" fill="white"/>']
        for q in self.commands:
            if q[0] in ('rect','ellipse'):
                kind,x,y,w,h,fill,stroke,*rest=q
                if kind=='rect': parts.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rest[0]}" fill="{fill}" stroke="{stroke}"/>')
                else: parts.append(f'<ellipse cx="{x+w/2}" cy="{y+h/2}" rx="{w/2}" ry="{h/2}" fill="{fill}" stroke="{stroke}"/>')
            elif q[0]=='polygon':parts.append(f'<polygon points="'+ ' '.join(f'{x},{y}' for x,y in q[1])+f'" fill="{q[2]}" stroke="{q[3]}"/>')
            elif q[0]=='line':
                _,pts,arrow,dash,col=q;parts.append('<polyline points="'+' '.join(f'{x},{y}' for x,y in pts)+f'" fill="none" stroke="{col}"'+(' stroke-dasharray="4 3"' if dash else '')+'/>')
                if arrow:
                    a,b=pts[-2:]; ang=math.atan2(b[1]-a[1],b[0]-a[0]); tips=[(b[0]-8*math.cos(ang+s*.4),b[1]-8*math.sin(ang+s*.4)) for s in [-1,1]]
                    parts.append('<polyline points="'+' '.join(f'{x},{y}' for x,y in [tips[0],b,tips[1]])+f'" fill="none" stroke="{col}"/>')
            else:
                _,x,y,label,size,bold,anchor,col=q
                for i,line in enumerate(label.split('\n')):parts.append(f'<text x="{x}" y="{y+i*size*1.25}" text-anchor="{anchor}" font-family="Arial,sans-serif" font-size="{size}" font-weight="{700 if bold else 400}" fill="{col}">{escape(line)}</text>')
        path.write_text(''.join(parts)+'</svg>',encoding='utf-8')

def diagram_pdf(name,title,pages):
    size=landscape(A3);c=canvas.Canvas(str(OUT/name),pagesize=size);c.setTitle('Pulso - '+title);c.setAuthor('Pulso / documentación técnica')
    for n,(subtitle,d,notes) in enumerate(pages,1):
        w,h=size;c.setFillColor(colors.HexColor(INK));c.setFont('Pulso-Bold',22);c.drawString(36,h-47,title)
        c.setFont('Pulso',12);c.drawString(36,h-72,subtitle)
        scale=min((w-72)/d.w,(h-165)/d.h);d.render(c,36,h-92-d.h*scale,scale)
        c.setFont('Pulso',9)
        for i,line in enumerate(notes):c.drawString(36,65-i*14,line)
        c.setFont('Pulso',8);c.drawRightString(w-36,20,f'{DATE} | {n}');c.showPage()
    c.save()

# Modelos BPMN: secuencias y geometría en una única fuente.
PROCESSES=[]
def process(pid,title,nodes,flows):PROCESSES.append((pid,title,nodes,flows))
# nodo: id, tipo, etiqueta, x, y, ancho, alto
process('Preparar','Registro, asignación e inicio',[
 ('s','startEvent','Necesidad de traslado',35,125,30,30),
 ('crear','userTask','Usuario: registrar\ndestino, actividad y CC',110,103,175,75),
 ('guardar','serviceTask','Sistema: guardar\nPENDING / ASSIGNED',330,103,165,75),
 ('cancelarQ','exclusiveGateway','¿Cancelar antes\nde iniciar?',550,115,50,50),
 ('cancelar','userTask','Admin: cancelar\ncon motivo',520,300,150,70),
 ('cancelado','endEvent','CANCELLED',730,320,30,30),
 ('asignadoQ','exclusiveGateway','¿Chofer\nasignado?',690,115,50,50),
 ('asignar','userTask','Admin: asignar\nchofer / vehículo',850,275,165,70),
 ('iniciar','userTask','Chofer: iniciar\ncon vehículo',815,103,160,75),
 ('validar','serviceTask','Sistema: validar recursos\ny odómetro inicial',815,440,185,70),
 ('validoQ','exclusiveGateway','¿Disponible y\nlectura conocida?',590,450,50,50),
 ('curso','endEvent','IN_PROGRESS\nViaje activo',390,460,30,30),
], [('s','crear','',None),('crear','guardar','',None),('guardar','cancelarQ','',None),('cancelarQ','cancelar','Sí',[(575,165),(575,300)]),('cancelar','cancelado','',None),('cancelarQ','asignadoQ','No',None),('asignadoQ','asignar','No',[(715,165),(715,310),(850,310)]),('asignar','cancelarQ','Revisar',[(932,275),(932,225),(575,225),(575,165)]),('asignadoQ','iniciar','Sí',None),('iniciar','validar','',[(895,178),(1045,178),(1045,475),(1000,475)]),('validar','validoQ','',[(815,475),(640,475)]),('validoQ','curso','Sí',[(590,475),(420,475)]),('validoQ','iniciar','No: corregir / esperar',[(615,450),(615,395),(1065,395),(1065,140),(975,140)])])
process('Ejecutar','Recorrido, eventual relevo y finalización',[
 ('s','startEvent','IN_PROGRESS',35,135,30,30),
 ('recorrer','userTask','Chofer: realizar\nel servicio',110,113,160,75),
 ('relevoQ','exclusiveGateway','¿Se necesita\nreasignación?',330,125,50,50),
 ('reasignar','userTask','Admin: elegir recursos\ny registrar km del relevo',290,305,195,75),
 ('reabrir','serviceTask','Sistema: cerrar viaje\ny abrir otro enlazado',555,305,180,75),
 ('finalizar','userTask','Chofer: finalizar\ncon odómetro de llegada',460,113,185,75),
 ('validar','serviceTask','Sistema: validar\nlecturas de kilometraje',700,113,175,75),
 ('validoQ','exclusiveGateway','¿Lectura\nválida?',945,125,50,50),
 ('cerrar','serviceTask','Sistema: cerrar viaje,\nactualizar km y auditar',850,440,190,75),
 ('fin','endEvent','COMPLETED',680,462,30,30),
], [('s','recorrer','',None),('recorrer','relevoQ','',None),('relevoQ','reasignar','Sí',[(355,175),(355,305)]),('reasignar','reabrir','',None),('reabrir','recorrer','Continuar',[(645,305),(645,245),(190,245),(190,188)]),('relevoQ','finalizar','No',None),('finalizar','validar','',None),('validar','validoQ','',None),('validoQ','finalizar','No: corregir',[(970,125),(970,65),(552,65),(552,113)]),('validoQ','cerrar','Sí',[(970,175),(970,440)]),('cerrar','fin','',[(850,477),(710,477)])])
process('Reportar','Reportes de servicios y centros de costos',[
 ('s','startEvent','Necesidad de reporte',35,135,30,30),
 ('periodo','userTask','Admin: elegir período\ny tipo de reporte',110,113,185,75),
 ('consulta','serviceTask','Sistema: consultar datos\ndel establecimiento',345,113,190,75),
 ('tipoQ','exclusiveGateway','¿Formato?',600,125,50,50),
 ('excel','serviceTask','Navegador: generar\nExcel con SheetJS',745,65,190,75),
 ('pdf','serviceTask','Servidor: generar\nPDF con FPDF',745,285,190,75),
 ('unir','exclusiveGateway','',995,195,50,50),
 ('fin','endEvent','Reporte descargado',1005,450,30,30),
], [('s','periodo','',None),('periodo','consulta','',None),('consulta','tipoQ','',None),('tipoQ','excel','Excel',[(625,125),(625,102),(745,102)]),('tipoQ','pdf','PDF',[(625,175),(625,322),(745,322)]),('excel','unir','',[(935,102),(1020,102),(1020,195)]),('pdf','unir','',[(935,322),(1020,322),(1020,245)]),('unir','fin','',[(1020,245),(1020,450)])])

NS={'bpmn':'http://www.omg.org/spec/BPMN/20100524/MODEL','bpmndi':'http://www.omg.org/spec/BPMN/20100524/DI','dc':'http://www.omg.org/spec/DD/20100524/DC','di':'http://www.omg.org/spec/DD/20100524/DI'}
for k,v in NS.items():ET.register_namespace(k,v)
def el(parent,tag,attrs={},text=None):
    prefix,name=tag.split(':');n=ET.SubElement(parent,'{'+NS[prefix]+'}'+name,attrs)
    if text is not None:n.text=text
    return n
defs=ET.Element('{'+NS['bpmn']+'}definitions',{'id':'PulsoDefinitions','targetNamespace':'https://pulso.local/modelos','exporter':'Pulso / entrega TI','exporterVersion':'1.0'})
bpmn_pages=[]
for pid,title,nodes,flows in PROCESSES:
    pr=el(defs,'bpmn:process',{'id':pid,'name':title,'isExecutable':'false'})
    nmap={n[0]:n for n in nodes}; edge_data=[]
    for n in nodes:
        id,typ,label,x,y,w,h=n;node=el(pr,'bpmn:'+typ,{'id':pid+'_'+id,'name':label.replace('\n',' ')})
        el(node,'bpmn:documentation',text='Actor indicado en el nombre. Modelo descriptivo del código actual, no motor de ejecución.')
        for i,(a,b,l,pts) in enumerate(flows):
            if b==id:el(node,'bpmn:incoming',text=pid+'_f'+str(i))
        for i,(a,b,l,pts) in enumerate(flows):
            if a==id:el(node,'bpmn:outgoing',text=pid+'_f'+str(i))
    d=Diagram(1100,580)
    for i,(a,b,label,pts) in enumerate(flows):
        el(pr,'bpmn:sequenceFlow',{'id':pid+'_f'+str(i),'sourceRef':pid+'_'+a,'targetRef':pid+'_'+b,'name':label})
        if pts is None:
            aa=nmap[a];bb=nmap[b];pts=[(aa[3]+aa[5],aa[4]+aa[6]/2),(bb[3],bb[4]+bb[6]/2)]
        edge_data.append((i,pts,label));d.line(pts,arrow=True)
        if label:
            a,b=max(zip(pts,pts[1:]),key=lambda pair:math.dist(*pair))
            m=((a[0]+b[0])/2,(a[1]+b[1])/2)
            d.text(m[0]+5,m[1]-10,label,9,anchor='start')
    for id,typ,label,x,y,w,h in nodes:
        if typ.endswith('Event'):
            d.ellipse(x,y,w,h)
            if typ=='endEvent':d.ellipse(x+3,y+3,w-6,h-6)
            d.text(x+w/2,y+h+20,label,10)
        elif typ=='exclusiveGateway':
            d.polygon([(x+w/2,y),(x+w,y+h/2),(x+w/2,y+h),(x,y+h/2)]);d.text(x+w/2,y+h/2+5,'×',18)
            label_x=x+w/2
            if id=='validoQ':label_x+=70 if pid=='Ejecutar' else -85
            d.text(label_x,y-33,label,10)
        else:
            d.rect(x,y,w,h,PALE,TEAL,7);d.text(x+w/2,y+28,label,11)
            d.text(x+12,y+15,'U' if typ=='userTask' else 'S',8,bold=True,anchor='start')
    dg=el(defs,'bpmndi:BPMNDiagram',{'id':pid+'_diagram'});plane=el(dg,'bpmndi:BPMNPlane',{'id':pid+'_plane','bpmnElement':pid})
    for id,typ,label,x,y,w,h in nodes:
        shape=el(plane,'bpmndi:BPMNShape',{'id':pid+'_'+id+'_shape','bpmnElement':pid+'_'+id})
        el(shape,'dc:Bounds',{k:str(v) for k,v in dict(x=x,y=y,width=w,height=h).items()})
        if typ.endswith('Event') or typ=='exclusiveGateway':
            shift=(70 if pid=='Ejecutar' else -85) if id=='validoQ' else 0
            lab=el(shape,'bpmndi:BPMNLabel');el(lab,'dc:Bounds',{'x':str(x-60+shift),'y':str(y-45 if typ=='exclusiveGateway' else y+h+5),'width':str(w+120),'height':'40'})
    for i,pts,label in edge_data:
        edge=el(plane,'bpmndi:BPMNEdge',{'id':pid+'_f'+str(i)+'_edge','bpmnElement':pid+'_f'+str(i)})
        for x,y in pts:el(edge,'di:waypoint',{'x':str(x),'y':str(y)})
    d.svg(SRC/f'BPMN-{pid}.svg')
    notes=['Notación BPMN 2.0: círculo = evento; tarea U = usuario; tarea S = sistema; rombo con X = decisión exclusiva.']
    if pid=='Preparar':notes+=['Indefinido corresponde a centro de costos nulo. startNow ejecuta registro e inicio en la misma transacción.']
    if pid=='Ejecutar':notes+=['El relevo cierra el viaje saliente y abre otro con el odómetro del vehículo entrante. Si falla una validación, se revierte la operación.', 'El viaje iniciado solo puede finalizarse. Las correcciones de dirección y centro conservan el estado.']
    if pid=='Reportar':notes+=['Bitácora: solo completados. Resumen por centro: completados y cantidad de cancelados separados; no suma km cancelados.']
    bpmn_pages.append((title,d,notes))
defs[:]=sorted(defs,key=lambda node: node.tag=='{'+NS['bpmndi']+'}BPMNDiagram')
ET.indent(defs);ET.ElementTree(defs).write(SRC/'Pulso-procesos.bpmn',encoding='utf-8',xml_declaration=True)
diagram_pdf('01-Pulso-Procesos-BPMN.pdf','Procesos operacionales / BPMN',bpmn_pages)

# Tres vistas del mismo modelo físico; cada caja separa la PK de sus FK.
def entity(d, name, x, y, w, attrs=()):
    meta=SCHEMA['tables'][name]
    pk=next(c['COLUMN_NAME'] for c in meta['columns'] if c['COLUMN_KEY']=='PRI')
    fks=list(dict.fromkeys(f['COLUMN_NAME'] for f in meta['foreignKeys']))
    lines=[f'PK  {pk}'] + [f'FK  {f}' for f in fks] + list(attrs)
    h=41+len(lines)*16
    d.rect(x,y,w,h); d.rect(x,y,w,27,PALE)
    d.text(x+10,y+18,name,13,True,'start')
    for i,line in enumerate(lines): d.text(x+10,y+45+i*16,line,11, i==0,'start')

def relation(d, points, x, y, label):
    d.line(points)
    d.text(x,y,label,9,True,'start')

d=Diagram(1100,600)
relation(d,[(245,105),(320,105),(320,250),(406,250)],324,243,'1 : 0..*')
relation(d,[(245,283),(406,283)],267,275,'0..1 : 0..*')
relation(d,[(245,446),(330,446),(330,316),(406,316)],334,308,'0..1 : 0..*')
relation(d,[(850,137),(775,137),(775,250),(706,250)],715,241,'0..1 : 0..* (x2)')
relation(d,[(706,331),(847,331),(847,422),(862,422)],725,322,'1 : 0..*')
relation(d,[(950,165),(950,390)],955,291,'0..1 : 0..*')
relation(d,[(522,452),(522,536),(741,536),(741,390),(706,390)],530,524,'0..1 : 0..1 (relevo)')
entity(d,'establecimientos',25,55,220,['code','timezone'])
entity(d,'centros_costos',25,235,220,['code','name'])
entity(d,'vehiculos',25,395,220,['codigo_movil','current_odometer_km'])
entity(d,'viajes',406,219,300,['destino / actividad','started_at / ended_at','departure_odometer_km','arrival_odometer_km','status'])
entity(d,'usuarios',850,56,220,['username'])
entity(d,'revisiones_direccion',862,390,220,['revision','address','created_at'])
d.svg(SRC/'MER-Pulso.svg')

u=Diagram(1100,600)
relation(u,[(230,99),(365,99)],263,90,'1 : 0..*')
relation(u,[(139,149),(139,241),(413,241)],219,232,'1 : 0..*')
relation(u,[(470,149),(470,210)],480,183,'1 : 0..1')
relation(u,[(850,132),(850,241),(663,241)],701,232,'1 : 0..*')
relation(u,[(413,289),(167,289),(167,399)],192,279,'1 : 0..*')
relation(u,[(663,291),(880,291),(880,399)],720,282,'0..1 : 0..*')
entity(u,'establecimientos',40,71,190,['code'])
entity(u,'funcionarios',365,71,218,['nombre','unidad'])
entity(u,'roles',755,70,215,['codigo','nombre_rol','descripcion'])
entity(u,'usuarios',413,210,250,['username','active'])
entity(u,'sesiones',48,399,225,['token_hash','expires_at'])
entity(u,'registros_auditoria',755,399,260,['entity_type / entity_id','action'])
u.svg(SRC/'MER-Usuarios.svg')

v=Diagram(1100,500)
relation(v,[(230,111),(425,111)],274,102,'1 : 0..*')
relation(v,[(637,115),(747,115),(747,277),(792,277)],663,106,'0..1 : 0..*')
relation(v,[(637,334),(792,334)],676,325,'0..1 : 0..*')
relation(v,[(943,132),(943,225)],952,181,'1 : 0..*')
entity(v,'marcas_vehiculo',35,68,195,['nombre'])
entity(v,'modelos_vehiculo',425,68,212,['nombre'])
entity(v,'tipos_vehiculo',425,290,212,['nombre'])
entity(v,'establecimientos',821,57,211,['code'])
entity(v,'vehiculos',792,225,272,['codigo_movil','license_plate','current_odometer_km'])
v.svg(SRC/'MER-Flota.svg')
diagram_pdf('02-Pulso-Modelo-Entidad-Relacion.pdf','Modelo entidad-relación',[
    ('1 / Viajes y trazabilidad de dirección',d,[
        'PK = clave primaria. FK = clave foránea. Cardinalidad escrita como padre : hijos.',
        'Usuarios → viajes son dos relaciones opcionales: driver_id y created_by_user_id.',
        'Cada revisión pertenece a un viaje y puede tener un autor. El historial conserva cambios de destino durante el viaje.',
    ]),
    ('2 / Identidad institucional, roles, sesiones y auditoría',u,[
        'La FK compuesta usuarios(establishment_id, id_funcionario) vincula la cuenta a un funcionario de la misma institución.',
        'Un funcionario puede existir sin una cuenta. entity_id de auditoría es una referencia lógica, no una FK.',
    ]),
    ('3 / Catálogos maestros de la flota',v,[
        'Cada modelo pertenece a una marca. El vehículo referencia el modelo y el tipo de forma independiente.',
        'La lectura actual del vehículo se actualiza al cerrar un viaje o mediante un ajuste administrativo auditado.',
    ]),
])
# Añadir diccionario en un segundo PDF temporal y fusionar sin alterar el vector del MER.
dictionary=[p('Diccionario de datos e integridad','Heading1'),p('Extraído de INFORMATION_SCHEMA y SHOW CREATE TABLE de la instalación local. No contiene registros. MySQL '+SCHEMA['databaseVersion']+'.')]
sql={}
for name,meta in SCHEMA['tables'].items():
    fks={}
    for f in meta['foreignKeys']:
        fks.setdefault(f['COLUMN_NAME'],[]).append(f['REFERENCED_TABLE_NAME']+'.'+f['REFERENCED_COLUMN_NAME'])
    rows=[['Columna','Tipo','Nulo','Clave / referencia']]
    for col in meta['columns']:
        key=col['COLUMN_KEY']
        if col['COLUMN_NAME'] in fks:key+=' FK '+', '.join(fks[col['COLUMN_NAME']])
        if 'auto_increment' in col['EXTRA']:key+=' AUTO_INCREMENT'
        if 'GENERATED' in col['EXTRA']:key+=' Generada STORED'
        rows.append([col['COLUMN_NAME'],col['COLUMN_TYPE'],col['IS_NULLABLE'],key])
    dictionary.append(KeepTogether([p(name,'Heading2'),table(rows,[145,135,35,200]),Spacer(1,10)]))
    sql[name]=re.sub(r' AUTO_INCREMENT=\d+', '', meta['ddl'])+';'
dictionary += [PageBreak(),p('Restricciones y alcance','Heading1')]
rules=[
 'Las 13 tablas operativas tienen una PK entera autoincrementable con nombre id_[entidad en singular]. El MER emplea los nombres del esquema físico. migrations es infraestructura de CodeIgniter.',
 'Cada viaje tiene un único chofer y vehículo cuando se inicia. El destino se almacena como destino y la actividad como actividad. Antes de iniciar se puede cambiar la asignación sin crear otro viaje.',
 'En un relevo se registra la llegada del viaje saliente y se abre otro en la misma transacción. El nuevo viaje enlaza al anterior mediante id_viaje_anterior. La FK y su unicidad limitan la cadena a un sucesor por viaje.',
 'Las columnas generadas active_driver_id y active_vehicle_id tienen índices únicos. Se activan con status IN_PROGRESS y previenen dos viajes simultáneos para el mismo recurso.',
 'departure_odometer_km y arrival_odometer_km son las lecturas del viaje. Distancia = llegada menos salida cuando se conocen ambas. Al cerrar, la aplicación actualiza el odómetro del vehículo. Los ajustes administrativos requieren motivo y quedan auditados.',
 'Cada revisión de dirección tiene un viaje y puede referenciar un usuario autor. Se registra el destino al crear y después de cada corrección, con número de revisión y fecha. El autor puede faltar en el legado.',
 'Los usuarios pertenecen a un establecimiento y a un funcionario de la misma institución. roles reemplaza al ENUM. Las definiciones se mantienen por consola con php spark pulso:roles. Los permisos operativos vigentes son Administración y Chofer.',
 'Los perfiles Jefatura de Movilización, Despacho y Solicitante están en el catálogo. Sus permisos, aprobaciones y pantallas requieren definición funcional. Los funcionarios admiten unidad institucional.',
 'La identificación vehicular usa codigo_movil, patente y referencias a catálogos de tipos y modelos. Cada modelo tiene una marca. Si el dato histórico de marca falta, el catálogo la registra como desconocida.',
 'El aislamiento operacional deriva de la sesión y se valida en los repositorios y en ServiceEngine. El acceso por establecimiento es una regla de aplicación además de las relaciones físicas de pertenencia.',
 'No se cancelan viajes iniciados. Las cancelaciones anteriores y los kilometrajes históricos desconocidos se conservan como LEGACY. Un viaje histórico con varios tramos se transforma en viajes enlazados, con sus lecturas y recursos originales.',
 'El SQL es una referencia del esquema verificado. Para actualizar una instalación existente use las migraciones CodeIgniter con la aplicación detenida y un respaldo previo verificado.',
]
dictionary += [p(x) for x in rules]
document('_diccionario.pdf','Diccionario del modelo',dictionary)
from pypdf import PdfReader,PdfWriter
writer=PdfWriter()
for f in ['02-Pulso-Modelo-Entidad-Relacion.pdf','_diccionario.pdf']:writer.append(str(OUT/f))
writer.write(str(OUT/'_mer.pdf'));writer.close();(OUT/'_mer.pdf').replace(OUT/'02-Pulso-Modelo-Entidad-Relacion.pdf');(OUT/'_diccionario.pdf').unlink()
schema_order=re.findall(r'CREATE TABLE (\w+)', (ROOT/'apps/api-php/app/Database/schema-viajes.sql').read_text(encoding='utf-8'))
(SRC/'modelo-estructura.sql').write_text('-- Pulso: solo estructura de referencia. Instalar con migraciones CodeIgniter.\n\n'+'\n\n'.join(sql[name] for name in schema_order)+'\n',encoding='utf-8')
(SRC/'modelo-metadatos.json').write_text(json.dumps(SCHEMA,ensure_ascii=False,indent=2),encoding='utf-8')
markdown('MER-modelo-entidad-relacion.md','MER y diccionario', [('Fuente','Metadatos de 13 entidades de la base local. Ver MER-Pulso.svg, MER-Usuarios.svg, MER-Flota.svg, modelo-metadatos.json y modelo-estructura.sql.'),('Integridad','\n\n'.join(rules))])

# UML de casos de uso: actores, asociaciones y frontera del sistema.
CASES=[
 ('CU-01','Iniciar y cerrar sesión',['Chofer','Administración'],'Cuenta y establecimiento activos.','Validar credenciales; crear sesión con token aleatorio y hash en base; revocar al salir.','Credenciales inválidas: rechazo; cinco fallos bloquean 15 minutos. Clave Única solo si está configurada.'),
 ('CU-02','Registrar servicio',['Chofer','Administración'],'Sesión válida.','Ingresar destino, actividad y centro o Indefinido; opcionalmente chofer y vehículo. Guardar o iniciar.','Sin chofer: PENDING. Con chofer: ASSIGNED. El chofer queda asignado a sí mismo. startNow fallido revierte el registro completo.'),
 ('CU-03','Consultar servicios e historial',['Chofer','Administración'],'Sesión válida.','Filtrar por estado; consultar datos y lecturas del viaje. Administración consulta también por chofer o vehículo.','Chofer solo ve sus servicios actuales/asignados. Administración solo consulta su institución.'),
 ('CU-04','Iniciar viaje',['Chofer'],'ASSIGNED y chofer actual; vehículo activo y odómetro conocido.','Tomar automáticamente odómetro actual, registrar salida y pasar a IN_PROGRESS.','Recurso ocupado: rechazo. El administrador no puede iniciar en nombre del chofer. Un cambio de vehículo ya asignado requiere administración.'),
 ('CU-05','Finalizar viaje',['Chofer'],'IN_PROGRESS; chofer actualmente asignado.','Ingresar odómetro de llegada; validar; registrar llegada, actualizar vehículo y marcar COMPLETED.','Lectura inferior o versión antigua: rechazo sin cierre. Administración no ejecuta complete por el chofer.'),
 ('CU-06','Asignar o reasignar recursos',['Administración'],'PENDING, ASSIGNED o IN_PROGRESS.','Elegir recursos activos de la institución. En ruta registrar km del vehículo saliente, cerrar el viaje actual e iniciar otro enlazado en la misma transacción.','Sin cambios: rechazo. Recurso ocupado o lectura inválida: rollback. No modifica la identidad del vehículo.'),
 ('CU-07','Corregir dirección',['Administración'],'Servicio existente de la institución y versión vigente.','Guardar corrección y revisión de dirección; el chofer ve aviso y puede marcar Entendido.','El reconocimiento del aviso se conserva localmente en el navegador; no es un acuse centralizado de lectura.'),
 ('CU-08','Asignar centro de costos',['Administración'],'Servicio existente, centro activo de la institución.','Cambiar centro o dejar Indefinido; registrar cambio auditado.','No se aceptan centros ajenos ni inactivos. El centro puede asignarse después del inicio o del cierre.'),
 ('CU-09','Cancelar antes del inicio',['Administración'],'PENDING o ASSIGNED, started_at nulo.','Registrar motivo y pasar a CANCELLED con fecha.','IN_PROGRESS y COMPLETED: rechazo. No hay cierre de cancelación, km cancelados ni creación automática de retorno.'),
 ('CU-10','Registrar vehículo',['Administración'],'Datos de identificación revisados.','Registrar rol, patente, tipo, modelo, año y kilometraje inicial.','Identificadores duplicados o valores inválidos: rechazo. Tras crear, los datos identificativos quedan fijos.'),
 ('CU-11','Ajustar kilometraje',['Administración'],'Vehículo de su institución sin viaje activo y updatedAt vigente.','Ingresar nueva lectura entera y motivo; guardar con auditoría.','No permite cambiar rol, patente, modelo, tipo, año ni activación. El ajuste administrativo puede corregir inconsistencias del odómetro.'),
 ('CU-12','Consultar centros y exportar',['Administración'],'Período válido de hasta 365 días de diferencia.','Consultar bitácora o resumen por centro; exportar Excel local o PDF del servidor.','Bitácora incluye solo completados por fecha de finalización. Resumen cuenta cancelados por separado y no suma sus km. Fechas en zona institucional.'),
 ('CU-13','Provisionar establecimiento',['Operador TI'],'Acceso autorizado a consola del servidor.','Ejecutar pulso:establishment con código, nombre, zona IANA y usuario; clave inicial por variable de entorno.','Código/usuario duplicado o zona inválida: rechazo. Crea institución y administrador; no copia catálogos de otras instituciones.'),
]
def actor(d,x,y,name):
    d.ellipse(x-9,y,18,18);d.line([(x,y+18),(x,y+48)]);d.line([(x-20,y+29),(x+20,y+29)]);d.line([(x,y+48),(x-17,y+68)]);d.line([(x,y+48),(x+17,y+68)]);d.text(x,y+86,name,11,True)
uml_pages=[]
for who in ['Chofer','Administración']:
    cases=[case for case in CASES if who in case[2]]
    height=690 if who=='Administración' else 590
    d=Diagram(1100,height);d.rect(265,15,620,height-30);d.text(575,39,'Pulso / frontera del sistema',13,True)
    actor(d,90,200,who);actor(d,1010,65,'Clave Única')
    for i,(cid,title,*_) in enumerate(cases):
        x=340;y=55+i*(54 if who=='Administración' else 92)
        d.line([(110,235),(x,y+23)],color='#a1b4b8')
        if cid=='CU-01':d.line([(990,100),(840,78)],color='#a1b4b8')
    for i,(cid,title,*_) in enumerate(cases):
        x=340;y=55+i*(54 if who=='Administración' else 92)
        d.ellipse(x,y,500,46,PALE);d.text(x+250,y+28,cid+' '+title,11)
    if who=='Administración':
        actor(d,1010,585,'Operador TI');d.line([(990,620),(840,630)],color='#a1b4b8');d.ellipse(340,607,500,46,PALE);d.text(590,635,'CU-13 Provisionar establecimiento',11)
    d.svg(SRC/('UML-Chofer.svg' if who=='Chofer' else 'UML-Administracion.svg'))
    uml_pages.append((who+' / asociaciones y casos de uso',d,['Líneas continuas = asociaciones actor-caso; no representan flujo temporal. Los casos comunes conservan el mismo identificador en ambas vistas.','Clave Única es opcional; requiere habilitación. Operador TI usa consola y no es un rol de la aplicación. Ver especificaciones siguientes.']))
(SRC/'UML-casos-de-uso.svg').unlink(missing_ok=True)
diagram_pdf('03-Pulso-Casos-de-Uso-UML.pdf','Casos de uso / UML',uml_pages)
details=[]
for cid,title,actors,pre,flow,exception in CASES:
    details += [KeepTogether([p(cid+' / '+title,'Heading2'),p('Actores: '+', '.join(actors)),p('Precondición: '+pre),p('Flujo y resultado: '+flow),p('Alternativas y restricciones: '+exception)]),Spacer(1,10)]
document('_casos.pdf','Especificación de casos de uso',details)
writer=PdfWriter()
for f in ['03-Pulso-Casos-de-Uso-UML.pdf','_casos.pdf']:writer.append(str(OUT/f))
writer.write(str(OUT/'_uml.pdf'));writer.close();(OUT/'_uml.pdf').replace(OUT/'03-Pulso-Casos-de-Uso-UML.pdf');(OUT/'_casos.pdf').unlink()
plant=['@startuml','left to right direction','actor Chofer','actor "Administración" as Admin','actor "Operador TI" as TI','actor "Clave Única" as CU','rectangle Pulso {']
for cid,title,*_ in CASES:plant.append(f'  usecase "{cid}\\n{title}" as {cid.replace("-","")}')
plant.append('}')
for cid,title,actors,*_ in CASES:
    for a in actors:plant.append({'Chofer':'Chofer','Administración':'Admin','Operador TI':'TI'}[a]+' -- '+cid.replace('-',''))
plant+=['CU -- CU01','@enduml'];(SRC/'UML-casos-de-uso.puml').write_text('\n'.join(plant),encoding='utf-8')
markdown('UML-casos-de-uso.md','Casos de uso UML',[(cid+' '+title,'Actores: '+', '.join(actors)+'\n\nPrecondición: '+pre+'\n\nFlujo: '+flow+'\n\nExcepciones: '+exception) for cid,title,actors,pre,flow,exception in CASES])

REQS=[
 ('TEC-01','Must','CodeIgniter 4.x y PHP 8.4.x, separación MVC.','Verificado local','CI 4.7.5 / PHP 8.4.27; controladores, repositorios, dominio y vista React.','composer.lock; app/Controllers; app/Models; apps/web/src'),
 ('TEC-02','Must','Frontend HTML5, Bootstrap 5.x y React; Ajax mediante JavaScript.','Verificado local','React 19.2.8; Bootstrap utilities 5.3.8; fetch REST. No requiere jQuery al usar React.','apps/web/package.json; src/main.tsx; src/operations.ts'),
 ('TEC-03','Must','Base de datos: MySQL 16.x, según correo de TI.','Pendiente TI','Motor local MySQL 8.4.11. Confirmar producto y versión exactos; no asumir PostgreSQL ni MariaDB.','metadata de la base; migración CreatePulsoTables'),
 ('TEC-04','Must','PDF con FPDF 1.9.x.','Verificado local','FPDF 1.9.0; respuestas PDF verificadas en pruebas de API.','PdfExporter.php; ExportsController.php; CostCentersController.php'),
 ('TEC-05','Must','Excel con SheetJS / xlsx.','Verificado local','SheetJS 0.20.3 compilado dentro del frontend; sin carga de scripts remotos al exportar.','src/xlsx-export.ts; lockfile frontend'),
 ('TEC-06','Must','Bibliotecas y fuentes servidas localmente; sin CDN en ejecución.','Verificado estático','CSS, JS, fuentes y SVG locales. La URL npm de SheetJS se usa al instalar/compilar, no por el navegador en producción.','main.tsx; index.html compilado; assets locales'),
 ('TEC-07','Must','Operación independiente por establecimiento.','Verificado local','Consultas y mutaciones por institución; catálogos propios, zona horaria y provisión de administrador por consola.','AuthFilter; repositorios; UnitOfWork; pruebas de aislamiento'),
 ('TEC-08','Must','Facilitar integración de autenticación con Clave Única.','Implementado; piloto pendiente','Inicio OAuth, state de un solo uso, callback, consulta de identidad y vínculo a RUN registrado. Falta validación con proveedor real.','ClaveUnicaClient; AuthController; AuthRepository; TestAuth'),
 ('DOC-01','Must','Diagrama de procesos BPMN.','Entregado','Tres procesos BPMN descriptivos con XML editable y DI, SVG y PDF.','01-Pulso-Procesos-BPMN.pdf; Pulso-procesos.bpmn'),
 ('DOC-02','Must','Modelo entidad-relación.','Entregado','Trece entidades, cardinalidades, claves y diccionario obtenido del esquema real.','02-Pulso-Modelo-Entidad-Relacion.pdf'),
 ('DOC-03','Must','Casos de uso UML.','Entregado','Actores, frontera del sistema y trece casos con flujos y excepciones.','03-Pulso-Casos-de-Uso-UML.pdf'),
 ('DOC-04','Must','Copia de requerimientos levantados; MoSCoW deseable.','Entregado para revisión','Matriz derivada del correo TI y acuerdos del usuario; debe ser validada por la contraparte funcional.','04-Pulso-Requerimientos-MoSCoW.pdf'),
 ('RF-01','Must','Crear servicio con destino, actividad y centro de costos o Indefinido.','Verificado local','Sin actividad o destino no se guarda. Indefinido es cost_center_id NULL y se asigna después.','ServiceEngine::create; CostCenterField'),
 ('RF-02','Must','Solo un servicio simultáneo por chofer y vehículo.','Verificado local','Viajes activos únicos y validaciones transaccionales. Servicios futuros no ocupan recursos todavía.','viajes; ServiceEngine; prueba concurrente'),
 ('RF-03','Must','Iniciar y finalizar desde el chofer asignado.','Verificado local','Inicio toma lectura del vehículo; cierre exige odómetro válido y registra fechas. Administración no suplanta al chofer.','ServiceEngine start / complete'),
 ('RF-04','Must','Cancelación solo administrativa y previa al inicio.','Verificado local','PENDING / ASSIGNED sin started_at. IN_PROGRESS no se cancela.','ServiceEngine cancel; prueba de rechazo sin efectos'),
 ('RF-05','Must','Permitir reasignación de chofer o vehículo.','Verificado local','En ruta exige lectura del móvil saliente, finaliza su viaje y abre otro con la lectura propia del entrante.','ServiceEngine assignment'),
 ('RF-06','Must','Corregir dirección con historial y aviso al chofer.','Implementado','Aviso visible al actualizar datos; Entendido lo oculta en ese navegador. No es confirmación central en servidor.','revisiones_direccion; AddressChangeAlerts'),
 ('RF-07','Must','Vehículo con identidad fija; solo ajustar kilometraje.','Verificado local','Alta permitida; PATCH rechaza rol, patente, tipo, modelo, año y active. Motivo y versión obligatorios para km.','VehicleRepository; VehicleCard; pruebas API'),
 ('RF-08','Must','Exportar bitácora solo con completados del período.','Verificado local','Se usa ended_at y zona del establecimiento; excluye pendientes, activos y cancelados.','ReportRepository::daily; pruebas exportación'),
 ('RF-09','Must','Totales por centro con viajes y km.','Verificado local','Completados y cancelados separados; km solo completados con lecturas completas. Mostrar centros con actividad e incluir restantes opcionalmente.','ReportRepository::summary; CostCenterReport'),
 ('RF-10','Must','Historial de servicios por chofer y vehículo.','Implementado','Acceso administrativo desde sus nombres; cada viaje conserva su chofer y vehículo originales, incluidos los viajes cerrados por relevo.','OperationsDashboard; ServiceRepository'),
 ('MER-01','Must','PK enteras autoincrementables con nomenclatura institucional.','Implementado','Las 13 tablas operativas usan id_[entidad]. La migración remapea referencias y separa los tramos históricos.','ConsolidateTrips; diccionario físico'),
 ('MER-02','Must','Una entidad de viaje con lecturas de salida y llegada.','Verificado local','Un chofer y vehículo por viaje. El relevo cierra y crea un viaje enlazado de forma atómica.','viajes; ServiceEngine; pruebas de relevo'),
 ('MER-03','Must','Catálogos de roles, funcionarios y flota.','Implementado','roles, funcionarios, tipos_vehiculo, marcas_vehiculo y modelos_vehiculo. Código institucional en vehiculos.codigo_movil.','schema-viajes.sql; pulso:roles; alta de vehículo'),
 ('MER-04','Must','MER alineado con nombres, claves y cardinalidades físicas.','Entregado','Incluye relación opcional del usuario autor con cada revisión de dirección.','MER y diccionario físico'),
 ('FUT-02','Could','Pasajeros, solicitante formal y respaldo de la salida.','Por definir','Sujeto a requerimientos de Movilización. Jefatura, Despacho y Solicitante son definiciones de catálogo; faltan permisos y flujo aprobados.','Informe de revisión MER del 09-11-2026'),
 ('RNF-01','Must','Aislamiento, control de acceso y sesiones.','Verificado local','Roles ADMIN / DRIVER, Argon2id, cookie HttpOnly, token hash, bloqueo 5 fallos / 15 min. HTTPS y despliegue se verifican con TI.','AuthRepository; AuthFilter; AuthController'),
 ('RNF-02','Must','Evitar sobrescrituras y conservar trazabilidad.','Verificado local','Versiones, expectedUpdatedAt, transacciones y registros_auditoria. No se promete inmutabilidad frente al DBA.','UnitOfWork; ServiceEngine; AuditService'),
 ('UX-01','Should','Interfaz móvil legible, sobria y con temas claro/oscuro.','Implementado','Controles amplios, SVG locales, navegación adaptable y reduced-motion. Falta aceptación en dispositivos institucionales.','CSS responsive; ThemeToggle; componentes'),
 ('UX-02','Should','Autocompletar centro por código o nombre.','Implementado','Un campo con sugerencias y primera opción Indefinido.','CostCenterField.tsx'),
 ('FUT-01','Could','Canales de avisos centralizados y acuse de lectura.','Fuera de versión','Solo se ofrece aviso en la app mediante actualización periódica y reconocimiento local.','Propuesta; sin compromiso actual'),
 ('EX-01','Won’t','Cancelar viajes ya iniciados o registrar km de cancelación.','Excluido','Después de iniciar se finaliza con odómetro real. No hay retorno automático asociado.','Regla confirmada 26-10-2026'),
 ('EX-02','Won’t','Modificar rol u otra identidad de un vehículo registrado.','Excluido','Solo ajuste administrativo de kilometraje.','Regla confirmada 26-10-2026'),
 ('EX-03','Won’t','Gestionar información clínica o fichas de pacientes.','Fuera de alcance','Herramienta operacional de movilización. Los campos libres no son un sistema clínico.','Alcance funcional'),
]
items=[p('Propósito y fuentes','Heading1'),p('Copia consolidada de los requisitos aportados por la contraparte y de las decisiones funcionales del usuario. Es una línea base para revisión, no un acta firmada de aprobación. Las prioridades institucionales son Must; no se rebajan a mejoras opcionales.'),p('MoSCoW: Must = obligatorio; Should = deseable; Could = posible ampliación; Won’t = excluido de esta versión.'),p('La solicitud original de TI se reproduce al final. La versión de MySQL se conserva tal como fue solicitada y queda pendiente de aclaración; no se certifica una equivalencia.')]
for group,title in [('TEC','Requisitos técnicos institucionales'),('DOC','Documentación'),('RF','Requisitos funcionales'),('MER','Revisión del modelo de datos'),('RNF','Requisitos no funcionales'),('UX','Experiencia de uso'),('FUT','Posibles ampliaciones'),('EX','Exclusiones')]:
    if group=='RF': items.append(PageBreak())
    heading=[p(title,'Heading1')]
    for id,priority,desc,status,criterion,evidence in REQS:
        if id.startswith(group):
            items += [KeepTogether(heading + [p(f'{id} / {priority} / {desc}','Heading2'),p('Estado: '+status),p('Criterio y alcance: '+criterion),p('Evidencia: '+evidence,'SmallPulso')]),Spacer(1,7)]
            heading=[]
original='''Estimado, buenas tardes. Lo solicitado:

Asunto: Lineamientos técnicos para la aceptación de desarrollos externos

Para que el área de Desarrollo pueda evaluar y aceptar un desarrollo elaborado una unidad externa a TIC, es indispensable e inexcusable que el entregable cumpla estrictamente con los siguientes lineamientos técnicos:

Lenguajes y tecnologías soportadas

Backend: CodeIgniter 4.x (PHP 8.4.x) - obligatorio arquitectura MVC.

Frontend: HTML5, Bootstrap 5.x, JavaScript/jQuery, Ajax, React.

Base de datos: MySQL 16.x.

Librerías de salida: PDF (FPDF 1.9.x), Excel (SheetJS / xlsx).

Documentación obligatoria

Diagrama de procesos (BPMN).
Modelo Entidad-Relación de la base de datos (MER).
Casos de uso UML.
Copia de Requerimientos levantados (deseable Formato MosCow).

Nota importante:

El sistema debe ser desarrollado con enfoque multiestablecimiento, aunque inicialmente no este pensado para esto, de modo que pueda operar de forma independiente y escalable en distintas instituciones si se requiriera. Asimismo, no se permite el uso de librerías linkeadas (referenciadas vía CDN o servidores externos), por normas de seguridad institucional; todas deben estar alojadas localmente. Finalmente, el mecanismo de autenticación de usuarios y contraseñas -en caso de no ser desarrollado por el equipo- debe permitir y facilitar la integración con Clave Única, especialmente si la plataforma estará expuesta en internet y no solo en intranet.

El cumplimiento de estos lineamientos es un requisito estricto y no negociable para la implementación y adopción del desarrollo dentro de nuestra área. Entregables que no se ajusten a lo expuesto no podrán ser aceptados.

Quedo atento a cualquier consulta adicional.

Saludos cordiales,'''
items += [PageBreak(),p('Anexo / requerimiento aportado por TI','Heading1'),p('Transcripción del mensaje suministrado por el usuario; se normalizan únicamente guiones y espacios. No se dispone de un acta firmada ni del correo original como archivo.','SmallPulso')]+[p(x) for x in original.split('\n\n')]
styles['BodyText'].fontSize=9.5;styles['BodyText'].leading=13;styles['BodyText'].spaceAfter=6
styles['Heading2'].fontSize=11;styles['Heading2'].leading=14
document('04-Pulso-Requerimientos-MoSCoW.pdf','Requerimientos / MoSCoW',items)
styles['BodyText'].fontSize=10;styles['BodyText'].leading=14;styles['BodyText'].spaceAfter=7
styles['Heading2'].fontSize=12;styles['Heading2'].leading=16
markdown('REQ-requerimientos-moscow.md','Requerimientos MoSCoW',[(id+' / '+priority+' / '+desc,'Estado: '+status+'\n\nCriterio: '+criterion+'\n\nEvidencia: '+evidence) for id,priority,desc,status,criterion,evidence in REQS]+[('Anexo: mensaje de TI',original)])

audit=[p('Resultado de la corroboración','Heading1'),p('El sistema cumple localmente con el stack PHP / CodeIgniter, React, Bootstrap, FPDF y SheetJS solicitado; tiene aislamiento multiestablecimiento y recursos de interfaz locales. La aceptación integral permanece pendiente por la versión exacta de base de datos, la habilitación real de Clave Única y la validación de despliegue por TI. Esta revisión no certifica producción, rendimiento regional ni aprobación institucional.'),p('Corte auditado','Heading2'),p('Rama hospital-v2, base 77ce6a8e7b18c19f31b21c8983baf1931637402a más los cambios de consolidación de viajes y ajuste del MER. Los archivos y sus hashes se incluyen en inventario-auditado.json. No se publica ni cambia la base productiva.'),p('Matriz de lineamientos','TableSection')]
audit += [table([['Lineamiento','Estado','Evidencia / límite']]+[[r[2],r[3],r[4]+' Fuente: '+r[5]] for r in REQS if r[0].startswith(('TEC','DOC'))],[155,105,255])]
audit += [p('Arquitectura MVC con vista React','Heading1'),p('La capa Controller recibe REST y aplica autorización; Models contiene repositorios y consultas; Libraries concentra reglas de dominio, transacciones y exportadores. La vista es la SPA React compilada, servida por FrontendController desde public/index.html. No hay plantillas PHP para cada pantalla operacional: la vista React está separada del backend. React está expresamente incluido entre las tecnologías permitidas; TI debe conocer esta distribución al evaluar MVC.'),p('Dependencias locales y comunicaciones externas','Heading1'),p('Bootstrap 5.3.8 (utilidades), React, fuentes Inter e iconos SVG forman parte del build local. SheetJS se obtiene desde su distribuidor al instalar dependencias, y Vite lo empaqueta dentro de public/assets; no se referencia un CDN en ejecución. Composer instala CI y FPDF en vendor. Node se usa para compilar/desarrollar; el despliegue de la SPA compilada y PHP no necesita un servidor Node activo.'),p('El enlace Ver en Maps abre Google Maps por decisión del usuario. Clave Única, cuando se habilite, requiere comunicación HTTPS con el proveedor estatal. Son servicios externos, no bibliotecas cargadas por CDN. Una política de intranet que prohíba toda salida a internet requiere que TI decida si permite estos dos usos.'),p('Multiestablecimiento y límites reales','Heading1'),p('El aislamiento se implementa en la aplicación y se comprueba con dos instituciones de prueba, consultas, mutaciones, reportes y zonas horarias distintas. Las FK físicas por id no constituyen una política de seguridad por fila del motor. La provisión de nuevos establecimientos es por consola y sus catálogos deben cargarse por separado. Los RUN y usuarios son únicos globalmente: una cuenta pertenece a una institución; no hay selector de múltiples instituciones para una misma persona.'),p('La transacción bloquea una fila por institución; favorece consistencia para el piloto. No se realizó prueba de carga regional, alta disponibilidad ni recuperación ante desastres. Escalabilidad de infraestructura y concurrencia real deben validarse con TI.'),p('Autenticación y Clave Única','Heading1'),p('Autenticación local Argon2id, sesión opaca con hash SHA-256, HttpOnly y SameSite Strict; Secure en producción. La integración Clave Única usa state consumible y con vencimiento, intercambio de código, consulta de identidad y enlace a RUN preexistente. Pruebas con transporte simulado y validación de errores cubren el contrato; no sustituyen homologación ni sesión real del proveedor. TI debe registrar cliente y callback HTTPS, configurar secretos fuera del repositorio y validar RUN de usuarios autorizados.'),p('Verificaciones del código','Heading1'),p('La validación local ejecutó las pruebas de sesión, autenticación, provisión e integración PHP/MySQL. npm run build y npm run lint correctos. Las pruebas incluyen permisos, aislamiento, concurrencia, odómetros, restricciones de cancelación e identidad vehicular, reporte de completados y PDF real. El contrato de datos Excel está probado; la revisión no incluye abrir cada archivo en todas las versiones de Excel ni probar todos los navegadores/dispositivos.'),p('Pendientes para aceptación','Heading1')]
for text in [
 'TI: confirmar por escrito producto y versión exactos del requisito «MySQL 16.x». Se observa MySQL 8.4.11 local y no se declara cumplimiento de esa versión literal. No se migra a otro motor por inferencia.',
 'TI y responsable del sistema: aprobar la línea base funcional y los diagramas entregados. La documentación representa el código actual y las instrucciones recibidas, no constituye acta institucional firmada.',
 'TI: validar servidor PHP 8.4.x y extensiones exigidas por Composer, directorio público, permisos de writable, variables de entorno, TLS, dominio, copias y restauración, cuentas y claves definitivas. No se entrega .env ni copias con personas o viajes.',
 'TI / Clave Única: habilitación y prueba real del proveedor con credenciales institucionales, URL callback y usuarios autorizados. El requisito de facilitar integración está implementado; su puesta en servicio está pendiente.',
 'Equipo funcional: prueba piloto desde dispositivos y red del hospital; validar legibilidad, fechas, asignaciones, reportes y flujo diario. Las pruebas automatizadas no equivalen a aceptación de usuarios.'
]:audit.append(p(text))
audit += [p('Respuesta al informe MER del 09-11-2026','Heading1'), table([
 ['Observación','Resolución','Evidencia'],
 ['PK y nomenclatura','PK enteras AUTO_INCREMENT y nombres id_[entidad]. Tablas operativas en español. Se conservan algunos nombres técnicos de columnas.','SQL, diccionario y migración.'],
 ['Diagrama y atributos','Destinos y actividades coinciden con las columnas físicas. Se dibujan PK, FK y cardinalidades del historial de direcciones.','MER, vistas 1 a 3.'],
 ['Viajes y kilometraje','Una fila por viaje. El relevo cierra e inicia viajes enlazados de forma atómica. Lecturas por viaje y odómetro vigente derivado al cerrar.','ServiceEngine, viajes y pruebas de relevo.'],
 ['Personal y roles','Catálogo de roles y entidad funcionarios. Mantenedor por consola. Las nuevas definiciones no otorgan permisos por sí solas.','roles, funcionarios, pulso:roles.'],
 ['Flota','codigo_movil y referencias a tipo, modelo y marca. Los registros históricos conservan las marcas desconocidas como tales.','MER de flota y alta del vehículo.'],
 ['Pasajeros y respaldo','Pendiente de confirmación funcional.','MoSCoW FUT-02.'],
 ],[133,248,134]), p('Actualización de instalaciones existentes','Heading2'),
 p('Antes del cambio, detenga el servicio y verifique un respaldo restaurable. Ejecute php spark migrate. La migración copia primero a tablas temporales de esquema, remapea los UUID y activa el nuevo modelo con un renombrado atómico. Los folios anteriores cambian y los tramos históricos conservan sus recursos y lecturas como viajes enlazados. La reversión requiere restaurar el respaldo.')]
audit += [p('Referencias técnicas consultadas','Heading1'),p('Oracle MySQL: https://dev.mysql.com/doc/refman/8.4/en/mysql-releases.html','SmallPulso'),p('CodeIgniter MVC: https://codeigniter.com/user_guide/concepts/mvc.html','SmallPulso'),p('OMG BPMN 2.0.2: https://www.omg.org/spec/BPMN/2.0.2/About-BPMN','SmallPulso'),p('Los paquetes y versiones se corroboraron en los lockfiles y archivos instalados. No se sustituyen requisitos institucionales por recomendaciones de fabricantes.','SmallPulso')]
document('00-Pulso-Corroboracion-Tecnica.pdf','Corroboración de lineamientos TI',audit)
markdown('AUDITORIA-cumplimiento-2026-11-10.md','Corroboración de lineamientos TI',[
 ('Resultado','Cumplimiento local del stack y aislamiento. Aceptación integral pendiente: versión de MySQL solicitada, habilitación real Clave Única y despliegue hospitalario.'),
 ('Matriz','\n\n'.join(r[0]+': '+r[2]+'\nEstado: '+r[3]+'\n'+r[4]+'\nEvidencia: '+r[5] for r in REQS if r[0].startswith(('TEC','DOC')))),
 ('Validación','Suite local PHP/MySQL y sesión, build y lint correctos. No hay pruebas de carga regional ni homologación real Clave Única.'),
 ('Arquitectura','Controllers REST + Models/repositorios + Libraries de dominio; vista React compilada servida por FrontendController. Sin Node en ejecución productiva.'),
 ('Salidas externas','No hay scripts CSS o fuentes de CDN en ejecución. Maps es enlace voluntario; Clave Única usa HTTPS al proveedor cuando esté habilitado.'),
 ('Límites','Aislamiento lógico por aplicación, FK por id y usuario de una sola institución. Auditoría no criptográficamente inmutable. origin=LEGACY preserva registros históricos sin permitir nuevas cancelaciones en ruta.')])
markdown('BPMN-procesos.md','Procesos BPMN',[(pid+' / '+title,'Ver BPMN-'+pid+'.svg y Pulso-procesos.bpmn.\n\n'+('El relevo cierra el viaje actual y abre otro enlazado. Un viaje iniciado se finaliza con sus lecturas.' if pid=='Ejecutar' else 'Modelo descriptivo del comportamiento actual, no ejecutable.')) for pid,title,*_ in PROCESSES])

# Sustituir borradores antiguos por sus versiones actuales; conservar auditoría histórica con advertencia.
for name in ['BPMN-procesos.md','MER-modelo-entidad-relacion.md','UML-casos-de-uso.md','REQ-requerimientos-moscow.md']:
    shutil.copyfile(SRC/name,ROOT/'docs'/name)
old=ROOT/'docs/AUDITORIA-migracion-php-2026-10-08.md'
if old.exists():
    text=old.read_text(encoding='utf-8')
    if not text.startswith('> HISTÓRICO'):old.write_text('> HISTÓRICO: evaluación del 08-10-2026. No acredita el estado actual. Consultar entrega-ti-2026-11-10/AUDITORIA-cumplimiento-2026-11-10.md.\n\n'+text,encoding='utf-8')
evidence={}
for file in [ROOT/'apps/api-php/app/Database/schema-viajes.sql',ROOT/'apps/api-php/composer.lock',ROOT/'apps/web/package-lock.json',ROOT/'scripts/test-api.mjs']+list((ROOT/'apps/api-php/app').rglob('*.php'))+list((ROOT/'apps/web/src').rglob('*')):
    if file.is_file():evidence[str(file.relative_to(ROOT)).replace('\\','/')]=hashlib.sha256(file.read_bytes()).hexdigest()
(SRC/'inventario-auditado.json').write_text(json.dumps({'fecha':'2026-11-10','baseCommit':'77ce6a8e7b18c19f31b21c8983baf1931637402a','incluyeCambiosLocales':True,'sha256':evidence},indent=2),encoding='utf-8')
(SRC/'LEEME.md').write_text('''# Pulso / entrega para revisión TI

Fecha: 2026-11-10. No equivale a aceptación institucional ni certificado de producción.

Los cinco PDF están en la carpeta pdf del ZIP. Fuentes editables:
- Pulso-procesos.bpmn: BPMN 2.0 con tres procesos y geometría DI; importar en editor compatible.
- BPMN-*.svg: representación vectorial de los tres procesos.
- MER-Pulso.svg, MER-Usuarios.svg, MER-Flota.svg, modelo-metadatos.json y modelo-estructura.sql: MER y esquema sin registros.
- UML-casos-de-uso.puml y UML-*.svg: casos de uso editables y vistas por actor.
- REQ-requerimientos-moscow.md: línea base y transcripción de solicitud TI.
- AUDITORIA-cumplimiento-2026-11-10.md: matriz y límites de verificación.
- inventario-auditado.json: hashes del código revisado, sin secretos.

Esta entrega incorpora las observaciones del informe MER del 09-11-2026 y la regla de cierre y apertura por relevo. Las cancelaciones solo existen antes del inicio; solo se edita el kilometraje de un vehículo. La excepción histórica LEGACY no habilita nuevas cancelaciones en ruta. No incluye .env, credenciales, registros de usuarios ni bitácoras.

Pendiente de TI: versión literal «MySQL 16.x», habilitación real de Clave Única, despliegue y aceptación del piloto. Para actualizar una base existente, detener el servicio y comprobar un respaldo restaurable antes de ejecutar php spark migrate. Usar el SQL adjunto como referencia. La reversión requiere restauración.
''',encoding='utf-8')
from io import BytesIO
for pdf in sorted(OUT.glob('0?-Pulso-*.pdf')):
    reader=PdfReader(pdf); writer=PdfWriter()
    for i,page in enumerate(reader.pages,1):
        w=float(page.mediabox.width);h=float(page.mediabox.height);buffer=BytesIO()
        stamp=canvas.Canvas(buffer,pagesize=(w,h));stamp.setFillColor(colors.white);stamp.rect(w-270,12,240,23,stroke=0,fill=1)
        stamp.setFillColor(colors.HexColor(MUTED));stamp.setFont('Pulso',8);stamp.drawRightString(w-38,23,f'{DATE} | {i} / {len(reader.pages)}');stamp.save();buffer.seek(0)
        page.merge_page(PdfReader(buffer).pages[0]);writer.add_page(page)
    writer.add_metadata({'/Title':pdf.stem,'/Author':'Pulso / Oficina de Movilización'})
    destination=ROOT/'.runtime'/pdf.name;writer.write(destination);writer.close();shutil.copyfile(destination,pdf);destination.unlink()
archive=ROOT/'output/Pulso-Entregables-TI-2026-11-10.zip'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
    for f in sorted(SRC.rglob('*')):
        if f.is_file():z.write(f,'editables/'+str(f.relative_to(SRC)))
    for f in sorted(OUT.glob('0?-Pulso-*.pdf')):z.write(f,'pdf/'+f.name)
print('Generados 5 PDF y editables en',archive)
