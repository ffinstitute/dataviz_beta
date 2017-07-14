<?php

/**
 * Created by PhpStorm.
 * User: myles
 * Date: 12/7/2017
 * Time: 17:03
 */
class StockVariation
{
    private $db;

    function __construct()
    {
        $credential = parse_ini_file(__DIR__ . "/credential.ini", true);
        $db_credential = $credential['database'];

        $this->db = new \PDO("mysql:host={$db_credential['host']};dbname={$db_credential['database']};charset=utf8",
            $db_credential['username'], $db_credential['password'],
            [PDO::ATTR_EMULATE_PREPARES => false, PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
    }

    function getCompanies()
    {
        $stmt = $this->db->query('SELECT * FROM `nasdaq`.`companies`;');
        return $stmt->fetchAll(\PDO::FETCH_ASSOC);
    }

    function getExchanges()
    {
        $stmt = $this->db->query('SELECT DISTINCT `type` FROM `historical_exchange`;');
        return $stmt->fetchAll(\PDO::FETCH_COLUMN);
    }

    function getDateRange($company_id = 0, $exchange_type = "")
    {
        $company_id = round($company_id); // make sure it is integer.
        if ($exchange_type && $company_id) {
            $stmt = $this->db->query('SELECT min(`e`.`DATE`) AS `start_date`, max(`e`.`DATE`) AS `end_date` FROM '
                . '`nasdaq`.`historical_company` `c`  '
                . 'INNER JOIN `nasdaq`.`historical_exchange` `e` ON `c`.`DATE`=`e`.`DATE` '
                . "WHERE `e`.`TYPE`=" . $this->db->quote($exchange_type) . " AND `c`.`company_id`=$company_id;");
            return $stmt->fetch(\PDO::FETCH_ASSOC);
        } else {
            return false;
        }
    }
}