window.$ = window.jQuery = require('jquery');

require("bootstrap");

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
        $start_date = $('#start-date'),
        $end_date = $('#end-date'),
        $loading_overlay = $("div.loading"),
        selected_company_id = 0,
        selected_exchange = "",
        selected_company_obj,
        company_prices, exchange_prices,
        company_variations = [],
        exchange_variations = [],
        min_date, max_date,
        diagram_data = [],
        start_date, end_date,
        beta, correlation,
        domain_max = 5,
        $graph_div = $("#graphDiv"),
        graph_div_width,
        company_list,
        exchange_list;

    // initiate date pickers
    $start_date.datepicker({
        format: 'yyyy-mm-dd',
        autoclose: true
    }).on('changeDate', function (e) {
        // show loading
        showLoading(true);

        validateAndUpdateSelectedDates(e['date'], null, calculateVariations);
    });

    $end_date.datepicker({
        format: 'yyyy-mm-dd',
        autoclose: true
    }).on('changeDate', function (e) {
        // show loading
        showLoading(true);

        validateAndUpdateSelectedDates(null, e['date'], calculateVariations);
    });


    // listeners
    $company_select.on('change', function () {
        // show loading
        showLoading(true);
        // update stored data
        selected_company_id = this.value;
        selected_exchange = $(this.options[this.selectedIndex]).data('exchange');

        //update exchange
        $("#exchange-select").val(selected_exchange);

        // update date range picker
        if (loadAvailableDateRange()) {
            // pre-load price data
            preLoadPriceData();
        } else {
            showLoading(false); // selection not ready, hide loading
        }
    });

    $("button.set-start-date-min").click(function () {
        setStartDate(min_date);
    });

    $("button.set-end-date-max").click(function () {
        setEndDate(max_date);
    });

    $exchange_select.on('change', function () {
        // show loading
        showLoading(true);

        // update stored data
        selected_exchange = this.value;

        // update date range picker
        if (loadAvailableDateRange()) {
            // pre-load price data
            preLoadPriceData();
        } else {
            showLoading(false); // selection not ready, hide loading
        }
    });

    $(window).resize(function () {
        var new_graph_div_width = $graph_div.width();
        if (new_graph_div_width !== graph_div_width) {
            plotDiagram(diagram_data);
            graph_div_width = new_graph_div_width;
        }
    });


    // load options
    loadCompanies();
    loadExchanges();
    initSelections();

    // functions
    function loadCompanies() {
        $company_select.find("option.option").remove();

        $.get("./backend", {item: "company_list"}, function (response) {
            // console.log(response);

            if (response && response['companies']) {
                company_list = response['companies'];
                $company_select.empty();
                $.each(company_list.sort(sortByName), function () {
                    var name = this['name'] ? this['name'] : "";
                    var $option = $("<option></option>").addClass('option').val(this['id'])
                        .data({
                            exchange: this['exchange'],
                            name: name,
                            symbol: this['symbol']
                        }).text(name + " (" + this['symbol'] + ")");
                    $company_select.append($option);
                });
            }
        });
    }

    function sortByName(a, b) {
        var aName = a['name'].toLowerCase();
        var bName = b['name'].toLowerCase();
        return ((aName < bName) ? -1 : ((aName > bName) ? 1 : 0));
    }

    function loadExchanges() {
        $exchange_select.find("option.option").remove();

        $.get("./backend", {item: "exchange_list"}, function (response) {
            // console.log(response);

            if (response && response['exchanges']) {
                exchange_list = response['exchanges'];
                $exchange_select.empty();
                $.each(exchange_list, function () {
                    $exchange_select.append("<option class='option' value='" + this + "'>" + this + "</option>");
                });
            }
        });
    }

    function initSelections() {
        if (company_list && exchange_list) {
            $company_select.trigger('change');
        } else {
            setTimeout(function () {
                initSelections()
            }, 100);
        }
    }

    function loadAvailableDateRange() {
        enableDatePicker(false); //disable when we are getting data

        if (selected_company_id <= 0) {
            console.info("Company not selected, abort updating date range");
            return false;
        }

        if (!selected_exchange) {
            console.info("Exchange not selected, abort updating date range");
            return false;
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
        return true;
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
     * @param next_func
     *
     * When new date is selected, we check the other date and update accordingly to keep them a valid date range
     */
    function validateAndUpdateSelectedDates(new_start_date, new_end_date, next_func) {
        if (!selected_company_id || !selected_exchange) {
            // ignore if company/exchange not selected
            return false;
        }

        var format = "YYYY-MM-DD";

        if (new_start_date) {
            // validate
            // TODO
            if (false /** invalid **/) {
                return false;
            }

            start_date = new_start_date;

            if (moment(new_start_date) >= moment(end_date)) {
                setEndDate(moment(new_start_date).add(1, "days").format(format));
            }
        } else if (new_end_date) {
            // validate
            if (false /** invalid **/) {
                return false;
            }


            end_date = new_end_date;

            if (moment(start_date) >= moment(new_end_date)) {
                setStartDate(moment(new_end_date).subtract(1, "days").format(format));
            }
        }

        if (next_func) {
            next_func();
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
        if (retry_count) {
            if (retry_count > 0) retry_count--;
            else return false;
        } else retry_count = 100; // no more retry if fail after 10s

        if (company_prices && exchange_prices) {
            // really displaying
            var prev_company_price, prev_exchange_price;
            company_variations = [];
            exchange_variations = [];
            diagram_data = []; // empty variation arrays

            $.each(d3.timeDay.range(moment(start_date), moment(end_date).add(1, "day")), function () {
                var date_str = moment(this).format("YYYY-MM-DD"),
                    company_price = parseFloat(company_prices[date_str]),
                    exchange_price = parseFloat(exchange_prices[date_str]),
                    company_variation, exchange_variation;

                if (company_price && exchange_price && $.isNumeric(company_price) && $.isNumeric(exchange_price)) {
                    // some dates have no prices, like holidays
                    if (prev_company_price && prev_exchange_price) {
                        company_variation = (company_price / prev_company_price - 1) * 100;
                        company_variations.push({date: date_str, variation: company_variation});
                        exchange_variation = (exchange_price / prev_exchange_price - 1) * 100;
                        exchange_variations.push({date: date_str, variation: exchange_variation});

                        if (isNaN(company_variation)) {
                            console.warn("Stock Variation NaN");
                            return;
                        } else if (isNaN(exchange_variation)) {
                            console.warn("Exchange Variation NaN");
                            return;
                        }

                        diagram_data.push({
                            company_variation: company_variation,
                            exchange_variation: exchange_variation,
                            date: date_str
                        });
                    }

                    prev_company_price = company_price;
                    prev_exchange_price = exchange_price;
                }
            });

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
            showLoading(false);
            return console.info("Company not selected, abort updating date range");
        }

        if (!selected_exchange) {
            showLoading(false);
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
        ).always(function () {
            showLoading(false);
        });
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


    /****** Initiate ******/
    $graph_div.find("svg").remove();

    var outer_width, outer_height, width, height, x, y,
        dot_radius = 4, //pixels
        margin = {top: 20, right: 20, bottom: 30, left: 50};

    // append svg
    var svg = d3.select("#graphDiv").append("svg"),
        g = svg.append("g").attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    // Add Axis
    g.append("g").attr("class", "x-axis");
    g.append("g").attr("class", "y-axis");
    /**** Initiated ****/


    function plotDiagram(data) {
        if (!data) {
            return false;
        }
        console.info(Date.now() % 100000, "Ploting data")
        var outer_div_width = $graph_div.width();
        outer_width = Math.min(Math.max(outer_div_width, 500), 700);
        outer_height = outer_width;

        width = outer_width - margin.left - margin.right;
        height = outer_height - margin.top - margin.bottom;
        x = d3.scaleLinear().range([0, width]);
        y = d3.scaleLinear().range([height, 0]);

        // console.log(data);
        g.selectAll("circle").remove();

        // update svg
        svg.attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
            .style("margin-left", ($("div.container").width() - outer_width) / 2);

        /*var x_max_abs = d3.max(data, function (d) {
         return Math.abs(d['exchange_variation']);
         }),
         y_max_abs = d3.max(data, function (d) {
         return Math.abs(d['company_variation']);
         });
         x_max_abs = y_max_abs = Math.max(x_max_abs, y_max_abs);
         */
        x_max_abs = y_max_abs = domain_max;

        x.domain([-x_max_abs, x_max_abs]);
        y.domain([-y_max_abs, y_max_abs]);

        // Update the scatterplot
        var dots = g.selectAll("circle").data(data);

        dots.enter().append("circle")
            .attr("r", dot_radius)
            .attr("cx", function (d) {
                return x(d['exchange_variation']);
            })
            .attr("cy", function (d) {
                return y(d['company_variation']);
            })
            .attr("class", "dot")
            .on("mouseover", function (d) {
                var $tooltip = $("#tooltip");
                var tooltip_left = parseFloat(d3.select(this).attr("cx")) + $graph_div.position()['left']
                    + $tooltip.width() / 2 + 72 + parseFloat($graph_div.find("svg").css("margin-left"));
                var tooltip_top = parseFloat(d3.select(this).attr("cy")) + $graph_div.position()['top']
                    - $tooltip.height() / 2 - 73;

                if (tooltip_left > width - 100) {
                    // might exceed right side of screen, switch to left
                    tooltip_left -= 179;
                }

                // handle dot
                d3.select(this).attr("r", dot_radius * 2.5).classed("hover", true);

                // handle tooltip
                var tooltip = d3.select("#tooltip")
                    .style("left", tooltip_left + "px")
                    .style("top", tooltip_top + "px")
                    .classed("hidden", false);

                tooltip.select(".date").text(d['date']);
                tooltip.select(".stock .name").text($company_select.find("option:selected").data('symbol'));
                tooltip.select(".exchange .name").text(selected_exchange);
                tooltip.select(".stock .value").text(parseFloat(d['company_variation']).toFixed(2) + "%");
                tooltip.select(".exchange .value").text(parseFloat(d['exchange_variation']).toFixed(2) + "%");

            })
            .on("mouseout", function () {
                // handle dot
                d3.select(this).attr("r", dot_radius).classed("hover", false);

                // hide tooltip
                d3.select("#tooltip").classed("hidden", true);
            })
            .merge(dots);

        // Update line
        g.selectAll("line").remove();
        if (beta) {
            g.append("line")
                .attr("x1", x(-x_max_abs))
                .attr("y1", y(-beta * x_max_abs))
                .attr("x2", x(x_max_abs)) // variation is change in percentage, which cannot exceed 100
                .attr("y2", y(beta * x_max_abs))
                .attr("class", "beta-line");
        }

        // Update Axis
        g.select(".x-axis")
            .attr("transform", "translate(0," + height / 2 + ")")
            .call(d3.axisBottom(x));

        g.select(".y-axis")
            .attr("transform", "translate(" + width / 2 + ",0)")
            .call(d3.axisLeft(y));
    }
});
