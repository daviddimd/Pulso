"""Validación estructural de los documentos generados; no accede a registros."""
from pathlib import Path
import json, zipfile, hashlib
from lxml import etree
from pypdf import PdfReader

root=Path(__file__).resolve().parents[1]
src=root/'docs/entrega-ti-2026-11-10'; pdfs=root/'output/entrega-ti-2026-11-10/pdf'
ns={'b':'http://www.omg.org/spec/BPMN/20100524/MODEL','bd':'http://www.omg.org/spec/BPMN/20100524/DI'}
doc=etree.parse(str(src/'Pulso-procesos.bpmn'))
xsd=root/'.runtime/bpmn-xsd/BPMN20.xsd'
if not xsd.exists():raise RuntimeError('Falta el esquema oficial OMG en .runtime/bpmn-xsd; consultar especificación BPMN 2.0.2.')
etree.XMLSchema(etree.parse(str(xsd))).assertValid(doc)
ids=doc.xpath('//@id'); assert len(ids)==len(set(ids))
counts=[]
for process in doc.findall('b:process',ns):
    nodes={n.get('id'):n for n in process if etree.QName(n).localname in ['startEvent','endEvent','exclusiveGateway','userTask','serviceTask']}
    flows=process.findall('b:sequenceFlow',ns); graph={id:[] for id in nodes};back={id:[] for id in nodes}
    for f in flows:
        a=f.get('sourceRef');b=f.get('targetRef');assert a in nodes and b in nodes
        graph[a].append(b);back[b].append(a)
        assert f.get('id') in [n.text for n in nodes[a].findall('b:outgoing',ns)]
        assert f.get('id') in [n.text for n in nodes[b].findall('b:incoming',ns)]
    def reachable(starts,g):
        seen=set();todo=list(starts)
        while todo:
            n=todo.pop()
            if n in seen:continue
            seen.add(n);todo.extend(g[n])
        return seen
    starts=[id for id,n in nodes.items() if etree.QName(n).localname=='startEvent']
    ends=[id for id,n in nodes.items() if etree.QName(n).localname=='endEvent']
    assert reachable(starts,graph)==set(nodes) and reachable(ends,back)==set(nodes)
    counts.append({'proceso':process.get('id'),'nodos':len(nodes),'secuencias':len(flows)})
metadata=json.loads((src/'modelo-metadatos.json').read_text(encoding='utf-8'))
primary_keys={'establecimientos':'id_establecimiento','usuarios':'id_usuario','vehiculos':'id_vehiculo',
    'centros_costos':'id_centro_costo','viajes':'id_viaje','revisiones_direccion':'id_revision_direccion',
    'sesiones':'id_sesion','registros_auditoria':'id_registro_auditoria','roles':'id_rol','funcionarios':'id_funcionario',
    'tipos_vehiculo':'id_tipo_vehiculo','marcas_vehiculo':'id_marca_vehiculo','modelos_vehiculo':'id_modelo_vehiculo'}
assert set(metadata['tables'])==set(primary_keys)
for name,table in metadata['tables'].items():
    keys=[c for c in table['columns'] if c['COLUMN_KEY']=='PRI']
    assert len(keys)==1 and keys[0]['COLUMN_NAME']==primary_keys[name]
    assert keys[0]['COLUMN_TYPE'].startswith(('int','bigint')) and keys[0]['EXTRA']=='auto_increment'
    for f in table['foreignKeys']:
        assert f['REFERENCED_TABLE_NAME'] in metadata['tables']
        assert f['REFERENCED_COLUMN_NAME'] in [c['COLUMN_NAME'] for c in metadata['tables'][f['REFERENCED_TABLE_NAME']]['columns']]
documents=[]
for pdf in sorted(pdfs.glob('0?-Pulso-*.pdf')):
    reader=PdfReader(pdf);texts=[p.extract_text() or '' for p in reader.pages]
    assert all(len(t.strip())>80 for t in texts)
    assert not any('\ufffd' in t or '\u25a0' in t for t in texts)
    documents.append({'archivo':pdf.name,'paginas':len(reader.pages),'sha256':hashlib.sha256(pdf.read_bytes()).hexdigest()})
assert len(documents)==5
usecases=(src/'UML-casos-de-uso.puml').read_text(encoding='utf-8');assert usecases.count('  usecase ')==13
report={'fecha':'2026-11-10','bpmnXsdOMG':'válido','idsUnicos':True,'alcanzabilidadBpmn':'todos los nodos conectan inicio y fin','procesos':counts,'entidades':len(primary_keys),'pkNumericasAutoincrementales':True,'casosUml':13,'pdfs':documents,'limites':'Esta validación documental no acredita una instalación hospitalaria, carga regional ni autenticación real contra Clave Única.'}
(src/'validacion-entregables.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
with zipfile.ZipFile(root/'output/Pulso-Entregables-TI-2026-11-10.zip','w',zipfile.ZIP_DEFLATED) as archive:
    for p in sorted(src.rglob('*')):
        if p.is_file():archive.write(p,'editables/'+str(p.relative_to(src)))
    for p in sorted(pdfs.glob('0?-Pulso-*.pdf')):archive.write(p,'pdf/'+p.name)
    names=archive.namelist()
    assert not any('.env' in n or 'node_modules' in n or 'vendor/' in n or '.runtime/' in n for n in names)
print('BPMN XSD OMG y conectividad: correctos. MER: 13 entidades y claves verificadas. UML: 13 casos. PDF: 5, texto válido.')
