<?php
namespace App\Controllers;
use App\Models\ReportRepository;
use App\Libraries\PdfExporter;
class CostCentersController extends BaseApiController {
    public function index() {
        return $this->jsonResponse(['costCenters'=>(new \App\Models\CatalogRepository())->costCenters($this->getEstablishmentId())]);
    }

    public function summary() { return $this->attempt(fn()=> $this->jsonResponse((new ReportRepository($this->getAuthUser(),$this->request->getGet()))->summary())); }
    public function export() { return $this->summary(); }
    public function exportPdf() {
        return $this->attempt(function() {
            $r=(new ReportRepository($this->getAuthUser(),$this->request->getGet()))->summary();
            $all=$this->request->getGet('includeInactive')==='true';
            $rows=array_filter($r['rows'],fn($c)=>$all||$c['completedTrips']+$c['cancelledTrips']>0);
            $pdf=PdfExporter::generateTablePdf('Centros de costos · '.$r['from'].' al '.$r['to'],['Código','Centro','Completados','Km','Cancelados','Sin km'],[22,115,36,30,36,31],array_map(fn($c)=>[$c['code'],$c['name'],$c['completedTrips'],$c['completedKm'],$c['cancelledTrips'],$c['completedUnknownKm']],$rows),'L',$this->getAuthUser()['establishmentName']);
            return $this->response->setContentType('application/pdf')->setHeader('Content-Disposition','attachment; filename="pulso-centros.pdf"')->setBody($pdf);
        });
    }
}
