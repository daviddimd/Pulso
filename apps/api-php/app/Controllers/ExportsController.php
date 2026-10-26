<?php
namespace App\Controllers;
use App\Models\ReportRepository;
use App\Libraries\PdfExporter;
class ExportsController extends BaseApiController {
    public function daily() { return $this->attempt(fn()=> $this->jsonResponse((new ReportRepository($this->getAuthUser(),$this->request->getGet()))->daily())); }
    public function dailyPdf() {
        return $this->attempt(function() {
            $r=(new ReportRepository($this->getAuthUser(),$this->request->getGet()))->daily();
            $rows=array_map(fn($s)=>[substr($s['id'],0,8),$s['driverName'],$s['vehicleRoleCode'],$s['serviceAddress'],$s['actionPerformed'],$s['distanceKm']??'Sin registro'],$r['services']);
            $pdf=PdfExporter::generateTablePdf('Servicios finalizados · '.$r['dateRange']['from'].' al '.$r['dateRange']['to'],['Servicio','Chofer','Vehículo','Destino','Actividad','Km'],[25,50,22,75,70,28],$rows,'L',$this->getAuthUser()['establishmentName']);
            return $this->response->setContentType('application/pdf')->setHeader('Content-Disposition','attachment; filename="pulso-servicios.pdf"')->setBody($pdf);
        });
    }
}
