$(document).ready(function () {
    var connectionsList = []
        , hierarchy = {}
        , reportTypes = {}
        , externalReports = []
    ;

    var RenderHierarchy = function () {
        if ($('.dReferenceWrapper').length > 0)
            $('.dReferenceWrapper').remove();
        hierarchy['external_report_external_id'] = ExternalReferenceHierarchy.getComponent('external_report_external_id', 'cp-connection', 'Sheet');
    };

    var RenderPCP = function () {
        var type = $('[name=bi-menu]:checked').val()
            , prevVal = $('#cp-connection').val()
            , pcp = _.filter(connectionsList, function (a) {
            return a.type === type;
        })
            , html = '';

        for (var i = 0; i < pcp.length; i++)
            html += '<option value="' + pcp[i].id + '">' + pcp[i].name + '</option>';

        $('#cp-connection').html(html);

        if (pcp.length > 1)
            $('#cp-connection-row').show();
        else
            $('#cp-connection-row').hide();

        if (prevVal != $('#cp-connection').val())
            $('#cp-connection').trigger('change');
    };

    var ProcessPCP = function (pcp) {
        for (var i = 0; i < pcp.length; i++)
            for (var k in biToolGlobalSettings.templates)
                if (biToolGlobalSettings.templates.hasOwnProperty(k)) {
                    var el = pcp[i];
                    if (0 === el.name.indexOf(k)) {
                        el.type = k;
                        el.name = el.name.replace(k + ' - ', '').replace(' (Plug-in)', '');

                        reportTypes[k] = 1;
                        connectionsList.push(el);
                    }
                }
    };

    var ProcessBursts = function (bursts) {
        var html = '';
        for (var i = 0; i < bursts.length; i++)
            html += '<option value="' + bursts[i].id + '">' + bursts[i].name + '</option>';

        $('#cp-existing-burst-select').html(html);

        if (bursts.length > 1) {
            $('.cp-existing-burst-row').show();
            $('#existing-burst-radio').attr('checked', 'checked');
        } else {
            $('#new-burst-radio').attr('checked', 'checked');
        }
    };

    var ProcessNS = function (ns) {
        var html = '';
        for (var i = 0; i < ns.length; i++) {
            var s = ns[i].id == biToolGlobalSettings.default_notification_schedule ? 'selected="selected"' : '';
            html += '<option ' + s + ' value="' + ns[i].id + '">' + ns[i].name + '</option>';
        }

        $('#cp-schedule-select').html(html);
    };

    var AssignExtReport = function (burstId, extReportId) {
        var mask = new Ext.DevxBodyMask({msg: 'Adding the report to the burst. please wait...'});
        mask.show();
        $.ajax({"url": "/api/burst_item/"
            , type: "POST"
            , dataType: 'json'
            , headers: {"Content-type": "application/json", "Accept": "application/json"}
            , data: JSON.stringify({
                "burst": burstId
                , "elements": [extReportId]
            })
        }).done(function (response) {
            mask.hide();
            console.log(response);
            alert(response.reports[0] + ' was added to ' + response.burst.name);
            $('#external_report_external_id').val(0).change();
        });
    };

    var CreateExtReport = function (burstId) {
        var external_report_external_id = $('#external_report_external_id').val()
            , find = _.find(externalReports, function(a){ return external_report_external_id == a.external_report_reference_id; });

        if('undefined'!==typeof(find))
            return AssignExtReport(burstId, find.id);

        var mask = new Ext.DevxBodyMask({msg: 'Creating Report. please wait...'});
        mask.show();
        var data = {
            "template": biToolGlobalSettings.templates[$('[name=bi-menu]:checked').val()]
            , "external_report_external_id": external_report_external_id
            , "plugin_connection_profile_id": $('#cp-connection').val()
            , "quick_creation": "Y"
        };

        if (hierarchy.external_report_external_id && hierarchy.external_report_external_id.external_report_external && hierarchy.external_report_external_id.external_report_external.name)
            data['name'] = hierarchy.external_report_external_id.external_report_external.name;

        $.ajax({"url": "/api/external_report/"
            , type: "POST"
            , dataType: 'json'
            , headers: {"Content-type": "application/json", "Accept": "application/json"}
            , data: JSON.stringify(data)
        }).done(function (response) {
            mask.hide();
            if (response && response.external_report && response.external_report.id) {
                AssignExtReport(burstId, response.external_report.id);
                console.log(response);
            } else
                console.log(response);
        });
    };

    var CreateBurst = function () {
        var mask = new Ext.DevxBodyMask({msg: 'Creating Burst. please wait...'});
        mask.show();

        var data = {"notification_schedule_id": $('#cp-schedule-select').val()
            , "digest_template_id": biToolGlobalSettings.digest_template
            , "enabled_ind": "Y"};

        if($('#cp-burst-name').val()>'')
            data['name'] = $('#cp-burst-name').val();

        $.ajax({"url": "/api/burst/"
            , type: "POST"
            , dataType: 'json'
            , headers: {"Content-type": "application/json", "Accept": "application/json"}
            , data: JSON.stringify(data)
        }).done(function (response) {
            mask.hide();
            if (response && response.burst && response.burst.id) {
                CreateExtReport(response.burst.id);
                console.log(response.burst);
            } else
                console.log(response);
        });
    };

    $.when(
        $.ajax({"url": "/api/data_source_plugin", dataType: 'json'})
        , $.ajax({"url": "/api/burst", dataType: 'json'})
        , $.ajax({"url": "/api/notification_schedule", dataType: 'json'})
    ).done(function (pcpResponse, burstResponse, nsResponse) {
        if (pcpResponse && pcpResponse[0] && pcpResponse[0].data_source_plugins && pcpResponse[0].data_source_plugins.length > 0)
            ProcessPCP(_.filter(pcpResponse[0].data_source_plugins, function(a){ return 'Y'===a.on_demand_element_creation; }));
        else {
            console.log('Can not load data_source_plugins');
            console.log(arguments);
            return;
        }

        if (burstResponse && burstResponse[0] && burstResponse[0].bursts && burstResponse[0].bursts.length > 0)
            ProcessBursts(burstResponse[0].bursts);

        if (nsResponse && nsResponse[0] && nsResponse[0].notification_schedules && nsResponse[0].notification_schedules.length > 0)
            ProcessNS(_.filter(nsResponse[0].notification_schedules, function(a){ return 'Y'===a.enabled; }));
        else {
            console.log('Can not load notification_schedules');
            console.log(arguments);
            return;
        }

        $('#cp-connection').bind('change', function () {
            RenderHierarchy();
        });

        $('#external_report_external_id').bind('change', function () {
            if ($('#external_report_external_id').val() > 0)
                $('.cp-selected-reference-row').show();
            else
                $('.cp-selected-reference-row').hide();
        });

        $('[name=bi-menu]').bind('click', function () {
            RenderPCP();
        });

        $('#cp-schedule-burst').bind('click', function () {
            if ($('#existing-burst-radio').is(':checked')) {
                CreateExtReport($('#cp-existing-burst-select').val());
            } else {
                CreateBurst();
            }
        });

        RenderPCP();
    });

    $.ajax({"url": "/api/external_report", dataType: 'json',
        "success":function(response){
            if(response && response.external_reports && response.external_reports.length>0)
                externalReports = response.external_reports;
        }});
});