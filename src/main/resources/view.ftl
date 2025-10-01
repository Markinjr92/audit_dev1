<style>
  /* CSS para 5 cards em uma linha */
  .col-sm-2-4 {
    width: 20%;
    float: left;
    position: relative;
    min-height: 1px;
    padding-left: 15px;
    padding-right: 15px;
  }
  
  @media (max-width: 768px) {
    .col-sm-2-4 {
      width: 50%;
      margin-bottom: 15px;
    }
  }
  
  @media (max-width: 480px) {
    .col-sm-2-4 {
      width: 100%;
      margin-bottom: 15px;
    }
  }
</style>

<div id="MyWidget_${instanceId}" class="super-widget wcm-widget-class fluig-style-guide" data-params="MyWidget.instance()">
  <!-- NavBar -->
  <ul class="nav nav-tabs" role="tablist">
    <li class="active"><a href="#tab-regras" role="tab" data-toggle="tab">Regras</a></li>
    <li id="li-dashboard">
      <a href="#tab-dashboard" role="tab" data-toggle="tab" onclick="MyWidget.carregarDashboard()">
        Dashboard
      </a>
    </li>
    <!-- NOVA ABA: só admin enxerga (JS mostra/oculta) -->
    <li id="li-config" style="display:none;">
      <a href="#tab-config" role="tab" data-toggle="tab" onclick="MyWidget.carregarAbaConfiguracoes()">Configurações</a>
    </li>
  </ul>

  <div class="tab-content">
    <!-- ABA REGRAS (inalterada) -->
    <div role="tabpanel" class="tab-pane active" id="tab-regras">
      <div id="rulesPanel" class="panel panel-default">
        <div class="panel-heading" style="background-color: #443e74; text-align: center; position: relative;">
          <h3 class="panel-title" style="color: white; font-weight: bold;">Lista de Regras</h3>
        </div>
        <div class="panel-body">
          <!-- Linha: Select + Ações -->
          <div class="row actions-inline" style="margin-top:20px;">
            <div class="col-md-9" style="min-width:250px;">
              <label for="selectPaciente">Selecione Conta Elaboração:</label>
              <select id="selectPaciente" class="form-control"></select>
            </div>
            <div class="col-md-3" style="white-space:nowrap; display:flex; gap:8px; justify-content:flex-end; align-items:flex-end;">
              <button class="btn btn-success" id="btnExecuteRules" onclick="MyWidget.ExecutarRegrasPaciente()">Executar Regras</button>
            </div>
          </div>

          <div class="row" style="margin-top:10px">
            <div class="col-sm-3">
              <label>Classificação</label>
              <select id="filterNatureza" class="form-control">
                <option value="">Todas</option>
              </select>
            </div>
            <div class="col-sm-9">
              <label>Busca</label>
              <input id="filterBusca" type="text" class="form-control" placeholder="Pesquisar em todas as colunas">
            </div>
          </div>

          <table class="table table-bordered" id="rulesTable" style="margin-top: 20px;">
            <thead>
              <tr>
                <th style="text-align:center;">
                  <input type="checkbox" id="selectAllRules" onclick="MyWidget.selecionarTodos(this)">
                </th>
                <th>Exibir</th>
                <th style="text-align:center; width:60px;">ID</th>
                <th>Regra</th>
                <th>Classificação</th>
                <th>Total de Ocorrências</th>
                <th>Email</th>
              </tr>
            </thead>
            <tbody></tbody>
          </table> 
        </div>       
      </div>
    </div>

    <!-- ABA DASHBOARD (NOVA) -->
    <div role="tabpanel" class="tab-pane" id="tab-dashboard">
      <div class="panel panel-default">
        <div class="panel-heading" style="background-color:#443e74;">
          <div class="row" style="display:flex; align-items:center;">
            <div class="col-sm-12" style="display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
              <h3 class="panel-title" style="color:white; font-weight:bold; margin-right:auto;">Dashboard</h3>
              <!-- Filtro de período -->
              <div class="form-inline" id="db-period-form" style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
                <label for="dbDateDe" style="color:#fff; margin-right:4px;">De</label>
                <input type="date" id="dbDateDe" class="form-control input-sm" style="min-width:150px;">
                <label for="dbDateAte" style="color:#fff; margin:0 4px 0 8px;">Até</label>
                <input type="date" id="dbDateAte" class="form-control input-sm" style="min-width:150px;">
                <button id="dbApply" class="btn btn-primary btn-sm" title="Aplicar filtro">Aplicar</button>
                <button id="dbClear" class="btn btn-default btn-sm" title="Limpar filtro">Limpar</button>
              </div>
            </div>
          </div>
        </div>

        <div class="panel-body">
          <!-- SEÇÃO: RESUMO GERAL -->
          <div class="dashboard-section" style="margin-bottom:30px; padding:20px; border:1px solid #e0e0e0; border-radius:8px; background-color:#f9f9f9;">
            <h4 style="margin-top:0; margin-bottom:15px; color:#443e74; border-bottom:2px solid #443e74; padding-bottom:8px;">
              <i class="fluigicon fluigicon-chart" style="margin-right:8px;"></i>Resumo Geral
            </h4>
            <div class="row">
              <div class="col-sm-12">
                <div class="card" style="background:linear-gradient(135deg, #667eea 0%, #764ba2 100%); color:white; border:none; border-radius:10px; padding:20px; text-align:center; margin-bottom:15px;">
                  <h3 style="margin:0; font-size:2.5em; font-weight:bold;" id="cardTotalOcorrencias">0</h3>
                  <p style="margin:5px 0 0 0; font-size:1.1em; opacity:0.9;">Total de Ocorrências</p>
                  <small style="opacity:0.8;">Período selecionado</small>
                </div>
              </div>
            </div>
            <div class="row">
              <div class="col-sm-2-4">
                <div class="card" style="background:linear-gradient(135deg, #ffc107 0%, #e0a800 100%); color:white; border:none; border-radius:8px; padding:15px; text-align:center;">
                  <h4 style="margin:0; font-size:1.8em; font-weight:bold;" id="cardOcorrenciasDescartadas">0</h4>
                  <p style="margin:5px 0 0 0; font-size:0.9em; opacity:0.9;">Descartadas</p>
                </div>
              </div>
              <div class="col-sm-2-4">
                <div class="card" style="background:linear-gradient(135deg, #17a2b8 0%, #138496 100%); color:white; border:none; border-radius:8px; padding:15px; text-align:center;">
                  <h4 style="margin:0; font-size:1.8em; font-weight:bold;" id="cardOcorrenciasInconsistentes">0</h4>
                  <p style="margin:5px 0 0 0; font-size:0.9em; opacity:0.9;">Inconsistentes</p>
                </div>
              </div>
              <div class="col-sm-2-4">
                <div class="card" style="background:linear-gradient(135deg, #28a745 0%, #1e7e34 100%); color:white; border:none; border-radius:8px; padding:15px; text-align:center;">
                  <h4 style="margin:0; font-size:1.8em; font-weight:bold;" id="cardOcorrenciasResolvidas">0</h4>
                  <p style="margin:5px 0 0 0; font-size:0.9em; opacity:0.9;">Resolvidas</p>
                </div>
              </div>
              <div class="col-sm-2-4">
                <div class="card" style="background:linear-gradient(135deg, #fd7e14 0%, #e8590c 100%); color:white; border:none; border-radius:8px; padding:15px; text-align:center;">
                  <h4 style="margin:0; font-size:1.8em; font-weight:bold;" id="cardOcorrenciasCorrigidas">0</h4>
                  <p style="margin:5px 0 0 0; font-size:0.9em; opacity:0.9;">Corrigidas</p>
                </div>
              </div>
              <div class="col-sm-2-4">
                <div class="card" style="background:linear-gradient(135deg, #6f42c1 0%, #5a2d91 100%); color:white; border:none; border-radius:8px; padding:15px; text-align:center;">
                  <h4 style="margin:0; font-size:1.8em; font-weight:bold;" id="cardOcorrenciasFaturadas">0</h4>
                  <p style="margin:5px 0 0 0; font-size:0.9em; opacity:0.9;">Finalizadas</p>
                </div>
              </div>
            </div>
          </div>

          <!-- SEÇÃO: ANÁLISE DE AUDITORES -->
          <div class="dashboard-section" style="margin-bottom:30px; padding:20px; border:1px solid #e0e0e0; border-radius:8px; background-color:#f9f9f9;">
            <h4 style="margin-top:0; margin-bottom:15px; color:#443e74; border-bottom:2px solid #443e74; padding-bottom:8px;">
              <i class="fluigicon fluigicon-user" style="margin-right:8px;"></i>Análise de Auditores
            </h4>
            <div class="row">
              <div class="col-sm-12">
                <h5 style="margin:0 0 8px;">Auditor por Status (Descartado / Inconsistente / Resolvido)</h5>
                <small class="text-muted">Respeita o período selecionado acima.</small>
                <div class="chart-container" style="position:relative; width:100%; height:480px;">
                  <canvas id="db_bar_auditor_status"></canvas>
                </div>
              </div>
            </div>
          </div>

          <!-- SEÇÃO: PERFORMANCE DAS REGRAS -->
          <div class="dashboard-section" style="margin-bottom:30px; padding:20px; border:1px solid #e0e0e0; border-radius:8px; background-color:#f9f9f9;">
            <h4 style="margin-top:0; margin-bottom:15px; color:#443e74; border-bottom:2px solid #443e74; padding-bottom:8px;">
              <i class="fluigicon fluigicon-list" style="margin-right:8px;"></i>Performance das Regras
            </h4>
            <div class="row">
              <div class="col-sm-12">
                <h5 style="margin:0 0 8px;">Ocorrências por Regra</h5>
                <small class="text-muted">Respeita o período selecionado acima. Passe o mouse sobre as barras para ver o título completo da regra.</small>
                <div class="chart-container" style="position:relative; width:100%; height:440px;">
                  <canvas id="db_bar_ocorrencias"></canvas>
                </div>
              </div>
            </div>
          </div>

          <!-- SEÇÃO: EVOLUÇÃO TEMPORAL -->
          <div class="dashboard-section" style="margin-bottom:30px; padding:20px; border:1px solid #e0e0e0; border-radius:8px; background-color:#f9f9f9;">
            <h4 style="margin-top:0; margin-bottom:15px; color:#443e74; border-bottom:2px solid #443e74; padding-bottom:8px;">
              <i class="fluigicon fluigicon-time" style="margin-right:8px;"></i>Evolução Temporal
            </h4>
            <div class="row">
              <div class="col-sm-12">
                <h5 style="margin:0 0 8px;">Ocorrências por Regra por Data</h5>
                <small class="text-muted">Respeita o período selecionado acima. Cada gráfico mostra a evolução de uma regra específica.</small>
                <div id="db_line_regras_data" class="row" style="margin-top:15px; margin-left:-5px; margin-right:-5px;">
                  <!-- Gráficos serão inseridos aqui dinamicamente -->
                </div>
              </div>
            </div>
          </div>

          <!-- SEÇÃO: GRÁFICOS DIÁRIOS POR REGRAS POR STATUS -->
          <div class="dashboard-section" style="margin-bottom:30px; padding:20px; border:1px solid #e0e0e0; border-radius:8px; background-color:#f9f9f9;">
            <h4 style="margin-top:0; margin-bottom:15px; color:#443e74; border-bottom:2px solid #443e74; padding-bottom:8px;">
              <i class="fluigicon fluigicon-chart" style="margin-right:8px;"></i>Gráficos Diários por Regras por Status
            </h4>
            <div class="row">
              <div class="col-sm-12">
                <h5 style="margin:0 0 8px;">Evolução por Status por Regra</h5>
                <small class="text-muted">Respeita o período selecionado acima. Cada gráfico mostra a evolução dos status de uma regra específica.</small>
                <div id="db_regras_status_data" class="row" style="margin-top:15px; margin-left:-5px; margin-right:-5px;">
                  <!-- Gráficos serão inseridos aqui dinamicamente -->
                </div>
              </div>
            </div>
          </div>

          <!-- SEÇÃO: GRÁFICOS POR REGRA COM AUDITOR E STATUS -->
          <div class="dashboard-section" style="margin-bottom:30px; padding:20px; border:1px solid #e0e0e0; border-radius:8px; background-color:#f9f9f9;">
            <h4 style="margin-top:0; margin-bottom:15px; color:#443e74; border-bottom:2px solid #443e74; padding-bottom:8px;">
              <i class="fluigicon fluigicon-users" style="margin-right:8px;"></i>Gráficos por Regra com Auditor e Status
            </h4>
            <div class="row">
              <div class="col-sm-12">
                <h5 style="margin:0 0 8px;">Auditor por Status por Regra</h5>
                <small class="text-muted">Respeita o período selecionado acima. Cada gráfico mostra a distribuição de auditores por status para uma regra específica.</small>
                <div id="db_auditor_regra_status" class="row" style="margin-top:15px; margin-left:-5px; margin-right:-5px;">
                  <!-- Gráficos serão inseridos aqui dinamicamente -->
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ABA CONFIGURAÇÕES (inalterada, só admin) -->
    <div role="tabpanel" class="tab-pane" id="tab-config">
      <div class="panel panel-default">
        <div class="panel-heading" style="background-color:#443e74; text-align:center;">
          <h3 class="panel-title" style="color:white; font-weight:bold;">Configurações</h3>
        </div>
        <div class="panel-body">
          <!-- SEÇÃO E-MAILS -->
          <div class="config-section" style="margin-bottom:30px; padding:20px; border:1px solid #e0e0e0; border-radius:8px; background-color:#f9f9f9;">
            <h4 style="margin-top:0; margin-bottom:15px; color:#443e74; border-bottom:2px solid #443e74; padding-bottom:8px;">
              <i class="fluigicon fluigicon-envelope" style="margin-right:8px;"></i>Gerenciamento de E-mails
            </h4>
            <div class="row">
              <div class="col-sm-8">
                <label>E-mails disponíveis</label>
                <select id="selectEmailsVinculo" class="form-control" multiple></select>
              </div>
              <div class="col-sm-4" style="display:flex; flex-direction:column; gap:8px; justify-content:flex-end;">
                <button id="btnAddEmailRMTop" type="button" class="btn btn-default" onclick="MyWidget.abrirModalAdicionarEmail()">
                  <i class="fluigicon fluigicon-plus" style="margin-right:5px;"></i>Adicionar E-mail
                </button>
                <button id="btnVincularEmails" class="btn btn-success" onclick="MyWidget.vincularEmailsAsRegrasSelecionadas()">
                  <i class="fluigicon fluigicon-link" style="margin-right:5px;"></i>Vincular E-mails
                </button>
              </div>
            </div>
          </div>

          <!-- SEÇÃO CLASSIFICAÇÕES -->
          <div class="config-section" style="margin-bottom:30px; padding:20px; border:1px solid #e0e0e0; border-radius:8px; background-color:#f9f9f9;">
            <h4 style="margin-top:0; margin-bottom:15px; color:#443e74; border-bottom:2px solid #443e74; padding-bottom:8px;">
              <i class="fluigicon fluigicon-tag" style="margin-right:8px;"></i>Gerenciamento de Classificações
            </h4>
            <div class="row">
              <div class="col-sm-8">
                <label>Classificações disponíveis</label>
                <select id="selectClassificacoesVinculo" class="form-control" multiple></select>
              </div>
              <div class="col-sm-4" style="display:flex; flex-direction:column; gap:8px; justify-content:flex-end;">
                <button id="btnAddClassificacao" type="button" class="btn btn-default" onclick="MyWidget.abrirModalAdicionarClassificacao()">
                  <i class="fluigicon fluigicon-plus" style="margin-right:5px;"></i>Adicionar Classificação
                </button>
                <button id="btnVincularClassificacoes" class="btn btn-info" onclick="MyWidget.vincularClassificacoesAsRegrasSelecionadas()">
                  <i class="fluigicon fluigicon-link" style="margin-right:5px;"></i>Vincular Classificações
                </button>
              </div>
            </div>
          </div>

          <!-- SEÇÃO AÇÕES DE REGRAS -->
          <div class="config-section" style="margin-bottom:30px; padding:20px; border:1px solid #e0e0e0; border-radius:8px; background-color:#f9f9f9;">
            <h4 style="margin-top:0; margin-bottom:15px; color:#443e74; border-bottom:2px solid #443e74; padding-bottom:8px;">
              <i class="fluigicon fluigicon-cog" style="margin-right:8px;"></i>Ações de Regras
            </h4>
            <div class="row">
              <div class="col-sm-12" style="display:flex; gap:12px; flex-wrap:wrap;">
                <!-- Botão Nova Regra disponível para admin e auditAdmin -->
                <button id="btnAddRule" class="btn btn-primary" style="display:none" onclick="MyWidget.abrirModalNovaRegra()" title="Criar nova regra">
                  <i class="fluigicon fluigicon-plus" style="margin-right:5px;"></i>Nova Regra
                </button>
                <button id="btnDisableRuleConfig" class="btn btn-warning" style="display:none" onclick="MyWidget.DesativarRegrasSelecionadasConfig()">
                  <i class="fluigicon fluigicon-remove" style="margin-right:5px;"></i>Desativar Regras Selecionadas
                </button>
              </div>
            </div>
          </div>

          <!-- TABELA DE REGRAS -->
          <div class="config-section" style="padding:20px; border:1px solid #e0e0e0; border-radius:8px; background-color:#f9f9f9;">
            <h4 style="margin-top:0; margin-bottom:15px; color:#443e74; border-bottom:2px solid #443e74; padding-bottom:8px;">
              <i class="fluigicon fluigicon-list" style="margin-right:8px;"></i>Lista de Regras
            </h4>
            <table class="table table-bordered" id="configRulesTable">
              <thead>
                <tr>
                  <th style="text-align:center;">
                    <input type="checkbox" id="selectAllRulesConfig" onclick="MyWidget.selecionarTodosConfig(this)">
                  </th>
                  <th style="text-align:center; width:60px;">ID</th>
                  <th>Título da Regra</th>
                  <th>Emails</th>
                  <th>Classificação</th>
                  <th>Ticket Médio</th>
                </tr>
              </thead>
              <tbody></tbody>
            </table>
          </div>

          <!-- REGRAS EM ANÁLISE -->
          <div class="config-section" style="margin-top:30px; padding:20px; border:1px solid #e0e0e0; border-radius:8px; background-color:#f9f9f9;">
            <h4 style="margin-top:0; margin-bottom:15px; color:#443e74; border-bottom:2px solid #443e74; padding-bottom:8px;">
              <i class="flaticon flaticon-clock" style="margin-right:8px;"></i>Regras em Análise
            </h4>
            <div class="row" style="margin-bottom:15px;">
              <div class="col-sm-12">
                <div class="btn-group" role="group">
                  <button type="button" class="btn btn-default active" id="btnAnalisePendente" onclick="MyWidget.filtrarRegrasAnalise('pendente')">
                    <i class="fluigicon fluigicon-time" style="margin-right:5px;"></i>Pendentes
                  </button>
                  <button type="button" class="btn btn-default" id="btnAnaliseRecusada" onclick="MyWidget.filtrarRegrasAnalise('recusada')">
                    <i class="fluigicon fluigicon-remove" style="margin-right:5px;"></i>Recusadas
                  </button>
                </div>
              </div>
            </div>
            <table class="table table-bordered" id="configRulesAnaliseTable">
              <thead>
                <tr>
                  <th style="text-align:center;">
                    <input type="checkbox" id="selectAllRulesAnalise" onclick="MyWidget.selecionarTodosAnalise(this)">
                  </th>
                  <th>Título da Regra</th>
                  <th>Status</th>
                  <th>Data Criação</th>
                  <th>Usuário</th>
                </tr>
              </thead>
              <tbody></tbody>
            </table>
          </div>

        </div>
      </div>
    </div>
  </div>
</div>

<style>
  .chip{display:inline-block;background:#eef1f7;border-radius:16px;padding:3px 8px;margin:2px 6px 2px 0}
  .chip .rm{margin-left:6px;cursor:pointer}
  .email-cell .btn{vertical-align:top}
  #rulesTable_wrapper > .row:first-child { margin-top: 12px; }
  #rulesTable_wrapper .dataTables_length { margin-top: 6px; }
  .filters-row { margin-bottom: 8px; }
  #rulesTable_wrapper .dataTables_length{
      margin: 6px 0 12px;
  }
  #rulesTable_wrapper .dataTables_length label{
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
  }
  #rulesTable_wrapper .dataTables_length select{
      min-width: 110px;
      height: 34px;
      padding: 6px 28px 6px 10px;
      border: 1px solid #ccc;
      border-radius: 4px;
      font-size: 14px;
      line-height: 1.42857143;
  }
  
  /* Estilo para ícone de loading */
  .icon-spin {
    animation: spin 1s linear infinite;
  }
  
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  
  /* Estilos para botões de seleção de regras */
  .regra-selector .btn,
  .regra-selector-status .btn,
  .regra-selector-auditor .btn {
    transition: all 0.2s ease;
    font-size: 12px;
    padding: 4px 8px;
    border-radius: 4px;
  }
  
  .regra-selector .btn:hover,
  .regra-selector-status .btn:hover,
  .regra-selector-auditor .btn:hover {
    transform: translateY(-1px);
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  }
  
  .regra-selector .btn.btn-primary,
  .regra-selector-status .btn.btn-primary,
  .regra-selector-auditor .btn.btn-primary {
    background-color: #337ab7;
    border-color: #2e6da4;
    color: white;
  }
  
  /* Estilo para destaque de busca */
  mark {
    background-color: #ffeb3b;
    color: #000;
    padding: 1px 2px;
    border-radius: 2px;
    font-weight: bold;
  }
</style>

<link rel="stylesheet" href="https://cdn.datatables.net/1.13.6/css/dataTables.bootstrap.min.css">
<script src="https://cdn.datatables.net/1.13.6/js/jquery.dataTables.min.js"></script>
<script src="https://cdn.datatables.net/1.13.6/js/dataTables.bootstrap.min.js"></script>

<script src="https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.0/dist/jspdf.plugin.autotable.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js"></script>

<script type="text/javascript" src="/webdesk/vcXMLRPC.js"></script>
<link href="https://cdn.jsdelivr.net/npm/select2@4.1.0-rc.0/dist/css/select2.min.css" rel="stylesheet" />
<script src="https://cdn.jsdelivr.net/npm/select2@4.1.0-rc.0/dist/js/select2.min.js"></script>

<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
