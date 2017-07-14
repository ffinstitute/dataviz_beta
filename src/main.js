window.$ = window.jQuery = require('jquery');

require("bootstrap");

var css = require('./main.css');
var d3 = require("d3");
var moment = require("moment");
var daterangepicker = require("daterangepicker");

// dev env
window.d3 = d3;
window.moment = moment;

$(document).ready(function () {
    /**
     * Some tests
     */
    // console.log($("div").length);
    // console.log(d3);
    // console.log(1251);
    /***********/


    var $company_select = $("#company-select"),
        $exchange_select = $("#exchange-select"),
        $data_table = $("#data-table"),
        $date_range_picker = $('input[name="date-range"]');

    var selected_company_id = 0,
        selected_exchange = "";

    var min_date, max_date;

    var company_prices, exchange_prices,
        company_variations = [],
        exchange_variations = [];

    // initiate date picker
    $date_range_picker.daterangepicker({
        locale: {
            format: 'YYYY-MM-DD'
        },
        isInvalidDate: function (date) {
            return !!(min_date && date < moment(min_date) || max_date && date > moment(max_date));

        },
        autoApply: true
    }, function (start_date, end_date, label) {
        calculateVariations(start_date, end_date);
    });


    // listeners
    $company_select.on('change', function () {
        // update company name in table
        $data_table.find("th.company .name").text($(this).find("option:selected").text());
        $data_table.find("th.company .text-muted").hide();

        // update stored data
        selected_company_id = this.value;

        // update date range picker
        loadAvailableDateRange();

        // pre-load price data
        preLoadPriceData();
    });

    $exchange_select.on('change', function () {
        // update exchange name in table
        $data_table.find("th.exchange .name").text(this.value);
        $data_table.find("th.exchange .text-muted").hide();

        // update stored data
        selected_exchange = this.value;

        // update date range picker
        loadAvailableDateRange();

        // pre-load price data
        preLoadPriceData();
    });


    // load options
    loadCompanies();
    loadExchanges();

    // functions
    function loadCompanies() {
        $company_select.find("option.option").remove();

        $.get("./backend", {item: "company_list"}, function (response) {
            // console.log(response);

            if (response && response['companies']) {
                $.each(response['companies'], function () {
                    $company_select.append("<option class='option' value='" + this['id'] + "'>" + this['symbol'] + "</option>");
                });
            }
        });
    }

    function loadExchanges() {
        $exchange_select.find("option.option").remove();

        $.get("./backend", {item: "exchange_list"}, function (response) {
            // console.log(response);

            if (response && response['exchanges']) {
                $.each(response['exchanges'], function () {
                    $exchange_select.append("<option class='option' value='" + this + "'>" + this + "</option>");
                });
            }
        });
    }

    function loadAvailableDateRange() {
        displayDatePicker(false); //hide when we are getting data

        if (selected_company_id <= 0) {
            return console.info("Company not selected, abort updating date range");
        }

        if (!selected_exchange) {
            return console.info("Exchange not selected, abort updating date range");
        }

        // now we have both values

        $.get("./backend",
            {
                item: "available_date_range",
                company_id: selected_company_id,
                exchange: selected_exchange
            }, function (response) {
                console.log(response);

                if (response && response['success']) {
                    var date_range = response['date_range'];
                    updateAvailableDateRange(date_range['start_date'], date_range['end_date']);
                }
            })
            .always(function () {
                displayDatePicker(true);
            });

    }

    function updateAvailableDateRange(new_min_date, new_max_date) {
        if (moment(new_min_date).isValid()) {
            min_date = new_min_date;
        }
        if (moment(new_max_date).isValid()) {
            max_date = new_max_date;
        }

        $date_range_picker.data('daterangepicker').setStartDate(min_date);
        $date_range_picker.data('daterangepicker').setEndDate(max_date);

        calculateVariations(min_date, max_date);
    }

    function displayDatePicker(is_shown) {
        if (is_shown) {
            $date_range_picker.show();
        } else {
            $date_range_picker.hide();
        }
    }

    function calculateVariations(start_date, end_date, retry_count) {
        if (retry_count) {
            if (retry_count > 0) retry_count--;
            else return false;
        } else retry_count = 100; // no more retry if fail after 10s

        $data_table.find("tbody").empty();

        if (company_prices && exchange_prices) {
            // really displaying
            var prev_company_price, prev_exchange_price,
                rows = [];
            company_variations = exchange_variations = []; // empty variation arrays

            $.each(d3.timeDay.range(moment(start_date), moment(end_date).add(1, "day")), function () {
                var date_str = moment(this).format("YYYY-MM-DD"),
                    company_price = company_prices[date_str],
                    exchange_price = exchange_prices[date_str],
                    company_variation = "",
                    exchange_variation = "";

                if (company_price && exchange_price) { // some dates have no prices, like holidays
                    if (prev_company_price) {
                        company_variation = ((company_price - prev_company_price) / prev_company_price * 100).toFixed(2);
                        company_variations.push({date: date_str, variation: company_variation});
                    }
                    if (prev_exchange_price) {
                        exchange_variation = ((exchange_price - prev_exchange_price) / prev_exchange_price * 100).toFixed(2);
                        exchange_variations.push({date: date_str, variation: exchange_variation});
                    }

                    prev_company_price = company_price;
                    prev_exchange_price = exchange_price;

                    rows.push("<tr><td>" + date_str + "</td><td>" + company_price + "</td><td>" + company_variation
                        + "</td><td>" + exchange_price + "</td><td>" + exchange_variation + "</td></tr>"); // just for dev #TODO: remove table
                }
            });
            $data_table.find("tbody").append(rows.reverse());
        } else {
            return setTimeout(function () {
                calculateVariations(start_date, end_date, retry_count);
            }, 100);
        }
    }

    function preLoadPriceData() {
        company_prices = exchange_prices = null; // clean data

        if (selected_company_id <= 0) {
            return console.info("Company not selected, abort updating date range");
        }

        if (!selected_exchange) {
            return console.info("Exchange not selected, abort updating date range");
        }

        $.get("./backend",
            {
                item: "price_data",
                company_id: selected_company_id,
                exchange: selected_exchange
            }, function (response) {
                if (response && response['success']) {
                    company_prices = response['company_prices'];
                    exchange_prices = response['exchange_prices'];


                }
            }
        );
    }

});