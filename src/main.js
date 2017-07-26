window.$ = window.jQuery = require('jquery');

require("bootstrap");

var css = require('./main.css');
var d3 = require("d3");
var moment = require("moment");
var datepicker = require("bootstrap-datepicker");
var math_func = require('./math_func.js');

// console.log(math_func);

// dev env #TODO: remove these lines
window.d3 = d3;
window.moment = moment;
window.math_func = math_func;

$(document).ready(function () {
    var $company_select = $("#company-select"),
        $exchange_select = $("#exchange-select"),
        $data_table = $("#data-table"),
        $start_date = $('#start-date'),
        $end_date = $('#end-date'),
        $loading_overlay = $("div.loading"),
        selected_company_id = 0,
        selected_exchange = "",
        company_prices, exchange_prices,
        company_variations = [],
        exchange_variations = [],
        min_date, max_date,
        diagram_data = [],
        start_date, end_date,
        beta, correlation;

    // initiate date pickers
    $start_date.datepicker({
        format: 'yyyy-mm-dd',
        autoclose: true
    }).on('changeDate', function (e) {
        start_date = e['date'];
        validateAndUpdateSelectedDates(start_date);
        calculateVariations();
    });

    $end_date.datepicker({
        format: 'yyyy-mm-dd',
        autoclose: true
    }).on('changeDate', function (e) {
        end_date = e['date'];
        validateAndUpdateSelectedDates(null, end_date);
        calculateVariations();
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

    $("button.set-start-date-min").click(function () {
        setStartDate(min_date);
    });

    $("button.set-end-date-max").click(function () {
        setEndDate(max_date);
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
                    var symbol_info = this['name'] ? (" (" + this['name'] + ")") : "";

                    $company_select.append("<option class='option' value='" + this['id'] + "'>" + this['symbol']
                        + symbol_info + "</option>");
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
        enableDatePicker(false); //disable when we are getting data

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
                // console.log(response);

                if (response && response['success']) {
                    var date_range = response['date_range'];
                    updateAvailableDateRange(date_range['start_date'], date_range['end_date']);
                }
            })
            .always(function () {
                enableDatePicker(true);
            });
    }

    function updateAvailableDateRange(new_min_date, new_max_date) {
        if (moment(new_min_date).isValid()) {
            min_date = new_min_date;
        }
        if (moment(new_max_date).isValid()) {
            max_date = new_max_date;
        }

        /**
         * !!! Caution: the following "StartDate" ans "EndDate" named by the datepicker plugin author means dates that
         * are available to choose from, which is totally different from variables with similar names elsewhere in this
         * project, e.g. start_date & end_date, which means the dates user actually chooses.
         */
        $start_date.datepicker('setStartDate', min_date);
        $start_date.datepicker('setEndDate', max_date);
        $end_date.datepicker('setStartDate', min_date);
        $end_date.datepicker('setEndDate', max_date);

        setStartDate(limitDateTo(min_date, false, 36));
        setEndDate(max_date);
        calculateVariations();
    }


    /**
     * @param original_date
     * @param from_date (string) The date we count days/months ago from. Default to today
     * @param months_ago
     * @param days_ago
     *
     * Return the earliest date on/after the original_date within days_ago days or months_ago months
     * Use months_ago only if days_ago is not valid
     */
    function limitDateTo(original_date, from_date, months_ago, days_ago) {
        if (from_date) {
            from_date = moment(from_date);
        } else {
            from_date = moment();
        }
        var format = "YYYY-MM-DD";
        days_ago = Math.floor(days_ago);
        original_date = moment(original_date);
        if (days_ago > 0) {
            return moment.max(original_date, from_date.subtract(days_ago, "days")).format(format)
        }

        months_ago = Math.floor(months_ago);
        if (months_ago > 0) {
            return moment.max(original_date, from_date.subtract(months_ago, "months")).format(format);
        }

        return false;
    }


    /***
     * @param new_start_date
     * @param new_end_date
     *
     * When new date is selected, we check the other date and update accordingly to keep them a valid date range
     */
    function validateAndUpdateSelectedDates(new_start_date, new_end_date) {

        if (new_start_date) {
            if (moment(new_start_date) > moment(end_date)) {
                setEndDate(new_start_date);
            }
        } else if (new_end_date) {
            if (moment(start_date) > moment(new_end_date)) {
                setStartDate(new_end_date);
            }
        }
    }

    // only use these set methods to ensure data integrity between UI and internal
    function setStartDate(new_start_date) {
        start_date = new_start_date;
        $start_date.datepicker('setDate', new_start_date);
    }

    function setEndDate(new_end_date) {
        end_date = new_end_date;
        $end_date.datepicker('setDate', new_end_date);
    }

    function enableDatePicker(is_enabled) {
        $start_date.toggleClass("disabled", !!is_enabled);
        $end_date.toggleClass("disabled", !!is_enabled);
    }

    function calculateVariations(retry_count) {
        showLoading(true);
        if (retry_count) {
            if (retry_count > 0) retry_count--;
            else return false;
        } else retry_count = 100; // no more retry if fail after 10s

        $data_table.find("tbody").empty();

        if (company_prices && exchange_prices) {
            // really displaying
            var prev_company_price, prev_exchange_price,
                rows = [];
            company_variations = [];
            exchange_variations = [];
            diagram_data = []; // empty variation arrays

            $.each(d3.timeDay.range(moment(start_date), moment(end_date).add(1, "day")), function () {
                var date_str = moment(this).format("YYYY-MM-DD"),
                    company_price = parseFloat(company_prices[date_str]),
                    exchange_price = parseFloat(exchange_prices[date_str]),
                    company_variation, exchange_variation;

                if (company_price && exchange_price && $.isNumeric(company_price), $.isNumeric(exchange_price)) {
                    // some dates have no prices, like holidays
                    if (prev_company_price && prev_exchange_price) {
                        company_variation = (company_price / prev_company_price - 1) * 100;
                        company_variations.push({date: date_str, variation: company_variation});
                        exchange_variation = (exchange_price / prev_exchange_price - 1) * 100;
                        exchange_variations.push({date: date_str, variation: exchange_variation});

                        diagram_data.push({
                            company_variation: company_variation,
                            exchange_variation: exchange_variation,
                            date: date_str
                        });
                    }

                    prev_company_price = company_price;
                    prev_exchange_price = exchange_price;

                    rows.push("<tr class='text-right'><td>" + date_str + "</td><td>" + company_price.toFixed(2)
                        + "</td><td>" + (undefined !== company_variation ? company_variation.toFixed(2) : "")
                        + "</td><td>" + exchange_price.toFixed(2) + "</td><td>"
                        + (undefined !== exchange_variation ? exchange_variation.toFixed(2) : "" )
                        + "</td></tr>"); // just for dev #TODO: remove table
                }
            });
            $data_table.find("tbody").append(rows.reverse());

            calculateAndUpdateValues();
            plotDiagram(diagram_data);

            showLoading(false);
        } else {
            return setTimeout(function () {
                calculateVariations(retry_count);
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

    function showLoading(to_show) {
        var is_hidden_now = $loading_overlay.is(":hidden");

        if (to_show && is_hidden_now) {
            $loading_overlay.show();
        } else if (!to_show && !is_hidden_now) {
            $loading_overlay.hide();
        }
    }


    /**********************
     * Math Calculation
     */
    function calculateAndUpdateValues() {
        var company_variation_array = company_variations.map(function (obj) {
                return obj['variation'];
            }),
            exchange_variation_array = exchange_variations.map(function (obj) {
                return obj['variation'];
            });

        if (company_variation_array && exchange_variation_array && company_variation_array.length === exchange_variation_array.length) {
            var covariance = math_func.covariance(company_variation_array, exchange_variation_array);
            // console.info("cov", covariance);

            var variance = math_func.variance(exchange_variation_array);
            // console.info("vari", variance);

            beta = covariance / variance;
            correlation = math_func.correlation(company_variation_array, exchange_variation_array);
            // console.info("corr", correlation);

            // update
            $(".beta").text(beta.toFixed(4));
            $(".correlation-coefficient").text(correlation.toFixed(4));
        } else return false;
    }

    /**********************
     * D3 Graph
     */
    var outer_width = 500,
        outer_height = 500;
    var margin = {top: 20, right: 20, bottom: 30, left: 50},
        width = outer_width - margin.left - margin.right,
        height = outer_height - margin.top - margin.bottom;


    var x = d3.scaleLinear().range([0, width]);
    var y = d3.scaleLinear().range([height, 0]);

    // append svg
    var svg = d3.select("#graphDiv").append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .style("margin-left", ($(document).width() - outer_width) / 2)
        .append("g")
        .attr("transform",
            "translate(" + margin.left + "," + margin.top + ")");

    // Add the X Axis
    svg.append("g")
        .attr("transform", "translate(0," + height / 2 + ")")
        .attr("class", "x-axis");

    // Add the Y Axis
    svg.append("g")
        .attr("transform", "translate(" + width / 2 + ",0)")
        .attr("class", "y-axis");

    function plotDiagram(data) {
        // console.log(data);
        svg.selectAll("circle").remove();

        var dot_radius = 2; //pixels

        var x_max_abs = d3.max(data, function (d) {
                return Math.abs(d['company_variation']);
            }),
            y_max_abs = d3.max(data, function (d) {
                return Math.abs(d['exchange_variation']);
            });
        x.domain([-x_max_abs, x_max_abs]);
        y.domain([-y_max_abs, y_max_abs]);

        // Update the scatterplot
        var dots = svg.selectAll("circle").data(data);

        dots.enter().append("circle")
            .attr("r", dot_radius)
            .attr("cx", function (d) {
                return x(d['company_variation']);
            })
            .attr("cy", function (d) {
                return y(d['exchange_variation']);
            })
            .attr("class", "dot")
            .on("mouseover", function (d) {
                var $graph_div = $("#graphDiv");
                var $tooltip = $("#tooltip");
                var tooltip_left = parseFloat(d3.select(this).attr("cx")) + $graph_div.position()['left']
                    + $tooltip.width() / 2 + 25 + parseFloat($graph_div.find("svg").css("margin-left"));
                var tooltip_top = parseFloat(d3.select(this).attr("cy")) + $graph_div.position()['top']
                    - $tooltip.height() / 2 - 25;

                // handle dot
                d3.select(this).attr("r", dot_radius * 3).classed("hover", true);

                // handle tooltip
                d3.select("#tooltip")
                    .style("left", tooltip_left + "px")
                    .style("top", tooltip_top + "px")
                    .classed("hidden", false)
                    .select(".date")
                    .html(d['date'] + "<br>(" + parseFloat(d['company_variation']).toFixed(2) + ", "
                        + parseFloat(d['exchange_variation']).toFixed(2) + ")");
            })
            .on("mouseout", function () {
                // handle dot
                d3.select(this).attr("r", dot_radius).classed("hover", false);

                // hide tooltip
                d3.select("#tooltip").classed("hidden", true);
            })
            .merge(dots);

        // Update line
        svg.selectAll("line").remove();
        svg.append("line")
            .attr("x1", x(-x_max_abs))
            .attr("y1", y(-beta * x_max_abs))
            .attr("x2", x(x_max_abs)) // variation is change in percentage, which cannot exceed 100
            .attr("y2", y(beta * x_max_abs))
            .attr("class", "beta-line");

        // Update the X Axis
        svg.select(".x-axis")
            .call(d3.axisBottom(x));

        // Update the Y Axis
        svg.select(".y-axis")
            .call(d3.axisLeft(y));
    }
});
