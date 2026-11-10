<?php
namespace App\Controllers;
use App\Models\ReportRepository;
use App\Libraries\PdfExporter;
class ExportsController extends BaseApiController {
    public function daily() { return $this->attempt(fn()=> $this->jsonResponse((new ReportRepository($this->getAuthUser(),$this->request->getGet()))->daily())); }
    public function dailyPdf() {
        return $this->attempt(function() {
            $r=(new ReportRepository($this->getAuthUser(),$this->request->getGet()))->daily();
            $rows=array_map(fn($s)=>[$s['id'],$s['driverName'],$s['vehicleRoleCode'],$s['serviceAddress'],$s['actionPerformed'],
                $s['departureOdometerKm']??'Sin registro',$s['odometerKm']??'Sin registro',$s['distanceKm']??'Sin registro'],$r['services']);
            $pdf=PdfExporter::generateTablePdf('Viajes finalizados · '.$r['dateRange']['from'].' al '.$r['dateRange']['to'],
                ['Folio','Chofer','Móvil','Destino','Actividad','Km salida','Km llegada','Km recorridos'],
                [20,43,20,60,60,24,24,24],$rows,'L',$this->getAuthUser()['establishmentName']);
            return $this->response->setContentType('application/pdf')->setHeader('Content-Disposition','attachment; filename="pulso-servicios.pdf"')->setBody($pdf);
        });
    }
}
