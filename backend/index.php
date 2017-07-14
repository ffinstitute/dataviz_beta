<?php
/**
 * Created by PhpStorm.
 * User: myles
 * Date: 12/7/2017
 * Time: 16:55
 */
header('Content-Type: application/json');
//require __DIR__ . "/../../vendor/autoload.php";

require_once __DIR__ . "/StockVariation.php";

$SV = new StockVariation();

$dat = [];
switch (@$_GET['item']) {
    case 'company_list':
        $companies = $SV->getCompanies();
        sendResponse(['success' => true, 'companies' => $companies]);
        break;


    case 'exchange_list':
        $exchanges = $SV->getExchanges();
        sendResponse(['success' => true, 'exchanges' => $exchanges]);
        break;


    case 'available_date_range':
        $date_range = $SV->getDateRange($_GET['company_id'], $_GET['exchange']);
        sendResponse(['success' => $date_range !== false, 'date_range' => $date_range]);
        break;

    default:
        sendResponse($_GET);
}


function sendResponse($res)
{
    $final_response = json_encode($res);
    if (json_last_error() == 0) {
        echo $final_response;
    } else {
        echo '["error":"Error encoding to JSON"]';
    }
    exit();
}