<?php
namespace App\Libraries;
use FPDF;
final class PdfExporter {
    public static function generateTablePdf(string $title,array $headers,array $widths,array $rows,string $orientation='L',string $institution='Pulso'): string {
        $pdf=new FPDF($orientation,'mm','A4'); $pdf->SetAutoPageBreak(false); $pdf->SetMargins(10,10,10);
        $encode=fn($s)=>iconv('UTF-8','Windows-1252//TRANSLIT',(string)$s);
        $header=function() use($pdf,$title,$institution,$headers,$widths,$encode) {
            $pdf->AddPage(); $pdf->SetFont('Arial','B',12); $pdf->MultiCell(0,6,$encode($title));
            $pdf->SetFont('Arial','',9); $pdf->MultiCell(0,5,$encode($institution)); $pdf->Ln(3);
            $pdf->SetFont('Arial','B',8); $pdf->SetFillColor(225,237,237);
            foreach($headers as $i=>$h) $pdf->Cell($widths[$i],8,$encode($h),1,0,'L',true);
            $pdf->Ln(); $pdf->SetFont('Arial','',8);
        };
        $header();
        foreach($rows as $row) {
            $lines=[]; $max=1;
            foreach(array_values($row) as $i=>$value) {
                $wrapped=['']; $line=0;
                foreach(preg_split('//u',(string)$value,-1,PREG_SPLIT_NO_EMPTY) as $ch) {
                    if($ch==="\n" || $pdf->GetStringWidth($encode($wrapped[$line].$ch)) > $widths[$i]-4) { $line++; $wrapped[$line]=''; }
                    if($ch!=="\n") $wrapped[$line].=$ch;
                }
                $lines[$i]=$wrapped; $max=max($max,count($wrapped));
            }
            // Split very long rows safely over pages and repeat column headings.
            for($line=0;$line<$max;$line++) {
                if($pdf->GetY()+5>$pdf->GetPageHeight()-12) $header();
                foreach($lines as $i=>$parts) $pdf->Cell($widths[$i],5,$encode($parts[$line]??''),'LR',0,'L');
                $pdf->Ln();
            }
            $x=10; foreach($widths as $w) { $pdf->Line($x,$pdf->GetY(),$x+$w,$pdf->GetY()); $x+=$w; }
        }
        return $pdf->Output('S');
    }
}
