window.$ = window.jQuery = require('jquery');

require("bootstrap");

var css = require('./main.css');
var d3 = require("d3");
var moment = require("moment");
var daterangepicker = require("daterangepicker");


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

    // initiate date picker
    $date_range_picker.daterangepicker({
        locale: {
            format: 'YYYY-MM-DD'
        },
        isInvalidDate: function (date) {
            return !!(min_date && date < moment(min_date) || max_date && date > moment(max_date));

        },
        autoApply: true,
        dateLimit: moment.duration(31, 'days')
    }, function (start, end, label) {
        // update data table
        $data_table.find("tbody").empty();
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
    });

    $exchange_select.on('change', function () {
        // update exchange name in table
        $data_table.find("th.exchange .name").text(this.value);
        $data_table.find("th.exchange .text-muted").hide();

        // update stored data
        selected_exchange = this.value;

        // update date range picker
        loadAvailableDateRange();
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
        // now we have both values
        if (selected_company_id <= 0) {
            return console.info("Company not selected, abort updating date range");
        }

        if (!selected_exchange) {
            return console.info("Exchange not selected, abort updating date range");
        }

        $.get("./backend",
            {
                item: "available_date_range",
                company_id: selected_company_id,
                exchange: selected_exchange
            }, function (result) {
                console.log(result);

                if (result && result['success']) {
                    var date_range = result['date_range'];
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

            // we can't use min_date here because the range will be too large to display
            $date_range_picker.data('daterangepicker').setStartDate(moment(max_date).subtract(31, "days"));
            $date_range_picker.data('daterangepicker').setEndDate(max_date);
        }

    }

    function truncateDateRange(original_start_date, original_end_date, max_days, to_earliest) {
        var diff_days = moment(original_end_date).diff(moment(original_start_date), 'days'),
            new_start_date = original_start_date,
            new_end_date = original_end_date;

        if (diff_days > max_days) {
            if (to_earliest) {
                new_start_date = original_start_date;
                new_end_date = moment(original_start_date).add(max_days, 'days').format("YYYY-MM-DD");
            } else {
                new_start_date = moment(original_end_date).subtract(max_days, 'days').format("YYYY-MM-DD");
                new_end_date = original_end_date;
            }
        }

        return {
            start_date: new_start_date,
            end_date: new_end_date
        }
    }

    function displayDatePicker(is_shown) {
        if (is_shown) {
            $date_range_picker.show();
        } else {
            $date_range_picker.hide();
        }
    }

});