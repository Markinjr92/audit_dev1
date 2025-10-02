function toInt(v){ const n = parseInt(v,10); return Number.isNaN(n) ? null : n; }
function escSql(s){ return String(s || '').replace(/'/g, "''"); }
// injeta CSS responsivo para modais (roda uma vez)
function escHtml(s){
  return String(s || '').replace(/[&<>"']/g, m => (
    { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]
  ));
}
// ajusta altura útil do body do modal para caber na viewport
function fitModalHeight(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  const body   = modal.querySelector('.modal-body');
  const header = modal.querySelector('.modal-header');
  const footer = modal.querySelector('.modal-footer');

  const vh = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);
  const headerH = header ? header.offsetHeight : 0;
  const footerH = footer ? footer.offsetHeight : 0;
  const margins = 32; // margem superior/inferior
  const maxH = Math.max(240, vh - headerH - footerH - margins);

  if (body) {
    body.style.maxHeight = maxH + 'px';
    body.style.overflowY = 'auto';
  }
}
function debounce(fn, delay){
  var t;
  return function(){
    var ctx = this, args = arguments;
    clearTimeout(t);
    t = setTimeout(function(){ fn.apply(ctx, args); }, delay);
  };
}


// Força escala logarítmica apenas para gráficos de barras (Chart.js)
(function(){
  function applyLogDefaults(Chart){
    try {
      // 1) Defaults globais para todos os gráficos de barra
      if (Chart && Chart.overrides) {
        Chart.overrides.bar = Chart.overrides.bar || {};
        Chart.overrides.bar.scales = Chart.overrides.bar.scales || {};
        Chart.overrides.bar.scales.y = Object.assign(
          // Mantém log para barras, mas com min < 1 para que valor 1 tenha altura visível
          { type: 'logarithmic', min: 0.5 },
          Chart.overrides.bar.scales.y || {}
        );
      }

      // 2) Plugin para remover beginAtZero e garantir min>0
      const LogScaleBarPlugin = {
        id: 'logScaleBarPlugin',
        beforeInit(chart) {
          try {
            if (!chart || !chart.config || chart.config.type !== 'bar') return;
            const options = chart.options || (chart.options = {});
            const scales = options.scales || (options.scales = {});
            const keys = Object.keys(scales).filter(k => {
              const s = scales[k] || {};
              const axis = s.axis || (k || '').toString().charAt(0).toLowerCase();
              return axis === 'y';
            });
            if (keys.length === 0) {
              // Sem eixo definido: define como log com min < 1
              scales.y = { type: 'logarithmic', min: 0.5 };
              return;
            }
            keys.forEach(k => {
              const s = scales[k] || (scales[k] = {});
              const isStacked = !!s.stacked;
              if (isStacked) {
                // Para barras empilhadas, mantemos escala linear para preservar proporções visuais.
                s.type = 'linear';
                if (Object.prototype.hasOwnProperty.call(s, 'min')) delete s.min;
                if (!Object.prototype.hasOwnProperty.call(s, 'beginAtZero')) s.beginAtZero = true;
              } else {
                // Para barras não empilhadas, força log com min < 1 para exibir valor 1.
                s.type = 'logarithmic';
                if (Object.prototype.hasOwnProperty.call(s, 'beginAtZero')) delete s.beginAtZero;
                if (s.min == null || s.min <= 0) s.min = 0.5;
              }
            });
          } catch(e) {}
        }
      };
      try { Chart.register(LogScaleBarPlugin); } catch(e) {}
    } catch(e) {}
  }

  function tryInit(){
    if (typeof window !== 'undefined' && window.Chart && !window.Chart.__logScaleBarApplied) {
      applyLogDefaults(window.Chart);
      window.Chart.__logScaleBarApplied = true;
      return true;
    }
    return false;
  }

  if (!tryInit()) {
    // Aguarda Chart.js carregar, se ainda não estiver disponível
    var tentativas = 0;
    var iv = setInterval(function(){
      tentativas++;
      if (tryInit() || tentativas > 100) clearInterval(iv);
    }, 100);
    if (typeof window !== 'undefined') {
      window.addEventListener('load', tryInit, { once: true });
    }
  }
})();


var MyWidget = SuperWidget.extend({
    // HOMOLOGAÇÃO
    // DATASET_RM: "DS_QUERY",
    // JDBC_RM: "/jdbc/BDRM2",
    // FORM_DOC_ID: 8124,
    // FILTRO_PADRAO: "REGISTRO = 'A'",
    // FILTRO_PADRAO: "CAST(DATAEXECUCAO AS DATE) = CAST(GETDATE() -1 AS date)",


    // PRODUÇÃO
    // DATASET_RM: "DS_QUERY_RM",
    // JDBC_RM: "/jdbc/BDRMPROD",
    // FORM_DOC_ID: 128059,
    // FILTRO_PADRAO: "REGISTRO = 'A'",
    // FILTRO_PADRAO: "CAST(GETDATE() AS DATE)",


    // PRODUÇÃO D1
    DATASET_RM: "DS_QUERY_RM",
    JDBC_RM: "/jdbc/BDRMHOMOLOG2",
    // FILTRO_PADRAO: "CAST(DATAEXECUCAO AS DATE) = CAST(GETDATE() -1 AS date)",
    FILTRO_PADRAO: "REGISTRO = 'A'",
    // FORM_DOC_ID: 128059,


    init: function () {
        this.usuario = WCMAPI.userCode;
        console.log(`[INIT] Usuário logado: ${this.usuario}`);

        // Papéis e permissões
        this.isAdmin = this.verificarAcessoAdmin(this.usuario);
        this.isAuditCadastro = this.verificarPapelAdmin(this.usuario, "auditCadastro");
        this.isAudit = this.verificarPapelAdmin(this.usuario, "audit");
        // compatibilidade com código existente
        this.admin = this.isAdmin;
        console.log(`[INIT] Permissões -> isAdmin: ${this.isAdmin}, isAuditCadastro: ${this.isAuditCadastro}, isAudit: ${this.isAudit}`);

        // Regras de visibilidade
        this.canSeeConfig = !!(this.isAdmin || this.isAuditCadastro);
        this.canSeeDashboard = !!this.isAdmin;

        try { this.aplicarVisibilidadeAbas(); } catch(e) { console.warn("aplicarVisibilidadeAbas:", e); }

        this.carregarPacientesInput();
        this.exibeDadosAdmin(this.admin);
        this.carregarRegrasAtivas(this.admin);
        $(function () {
          try { MyWidget.restaurarAbaPosReload(); } catch(e) { console.warn(e); }
        });
        
    },

    mostrarLoading: () => FLUIGC.loading(window).show(),
    esconderLoading: () => FLUIGC.loading(window).hide(),
    verificarPapelAdmin(usuario, role) {
      // Verifica se o usuário atual tem o papel especificado
      if (usuario === 'GABRIELAQUINO' || usuario === 'RUBENSSOUZA' || usuario === 'danieladm') {
      console.log(`[verificarPapelAdmin] Usuário '${usuario}' identificado como administrador por exceção.`);
      return true;
      }

      const constraints = [
      DatasetFactory.createConstraint('workflowColleagueRolePK.colleagueId', usuario, usuario, ConstraintType.MUST),
      DatasetFactory.createConstraint('workflowColleagueRolePK.companyId', '1', '1', ConstraintType.MUST),
      DatasetFactory.createConstraint('workflowColleagueRolePK.roleId', role, role, ConstraintType.MUST)
      ];
      
      console.log(`[verificarPapelAdmin] Constraints para usuário '${usuario}' e papel '${role}':`, constraints);
      
      const ds = DatasetFactory.getDataset('workflowColleagueRole', null, constraints, null);
      console.log(`[verificarPapelAdmin] Dataset workflowColleagueRole para usuário '${usuario}' e papel '${role}':`, ds);
      
      const hasRole = ds.values.length > 0;
      console.log(`[verificarPapelAdmin] Verificando papel '${role}' para usuário '${usuario}': ${hasRole}`);
      
      console.log(`[verificarPapelAdmin] Retornando resultado baseado no papel: ${hasRole}`);
      return hasRole;
    },
    
    // Nova função para verificar se o usuário tem acesso de administrador
    verificarAcessoAdmin(usuario) {
      // Verifica se o usuário tem papel de admin OU auditAdmin
      const hasAdminRole = this.verificarPapelAdmin(usuario, "admin");
      const hasAuditAdminRole = this.verificarPapelAdmin(usuario, "auditAdmin");
      console.log(`Usuário ${usuario} - hasAdminRole: ${hasAdminRole}, hasAuditAdminRole: ${hasAuditAdminRole}`);
      return hasAdminRole || hasAuditAdminRole;
    },
    exibeDadosAdmin(isAdmin) {
      // Botão Nova Regra visível para ADMIN e auditAdmin
      const btnAdd = document.querySelector("#btnAddRule");
      if (btnAdd) {
        // Verifica se o usuário tem papel 'admin' OU 'auditAdmin'
        const allowNova = this.verificarPapelAdmin(this.usuario, 'admin') || this.verificarPapelAdmin(this.usuario, 'auditAdmin');
        if (allowNova) {
          btnAdd.style.display = 'inline-block';
          btnAdd.disabled = false;
          btnAdd.title = 'Criar nova regra';
        } else {
          btnAdd.style.display = 'none';
          btnAdd.disabled = true;
          btnAdd.title = 'Disponível apenas para administradores e auditAdmin';
        }
      }
    
      const btnDisable = document.querySelector("#btnDisableRule");
      if (btnDisable) {
      btnDisable.style.display = isAdmin ? "block" : "none";
      if (isAdmin) {
        btnDisable.onclick = () => this.DesativarRegrasSelecionadas();
      }
      }
    
      // Aplica visibilidade de abas conforme regras
      try { this.aplicarVisibilidadeAbas(); } catch(e) { console.warn(e); }

      const btnDisableCfg = document.querySelector("#btnDisableRuleConfig");
      if (btnDisableCfg) {
        btnDisableCfg.style.display = isAdmin ? "block" : "none";
      }
    },

    // Centraliza visibilidade das abas por papel:
    // - audit: somente Regras
    // - auditCadastro: Regras e Configurações
    // - auditAdmin/admin: todas as abas
    aplicarVisibilidadeAbas() {
      const canSeeDashboard = !!this.canSeeDashboard;
      const canSeeConfig = !!this.canSeeConfig;

      // Dashboard
      const liDash = document.querySelector('#li-dashboard');
      if (liDash) liDash.style.display = canSeeDashboard ? 'block' : 'none';
      const tabDash = document.querySelector('#tab-dashboard');
      if (tabDash) tabDash.style.display = canSeeDashboard ? '' : 'none';

      // Configurações
      const liCfg = document.querySelector('#li-config');
      if (liCfg) liCfg.style.display = canSeeConfig ? 'block' : 'none';
      const tabCfg = document.querySelector('#tab-config');
      if (tabCfg) tabCfg.style.display = canSeeConfig ? '' : 'none';

      // Garante que a aba ativa seja visível; se não, volta para Regras
      const activeLi = document.querySelector('.nav-tabs li.active');
      if (activeLi && activeLi.style.display === 'none') {
        const regrasLink = document.querySelector('a[href="#tab-regras"]');
        if (regrasLink) { try { $(regrasLink).tab('show'); } catch(_) {} }
      }
    },

    carregarPacientesInput: function () {
      const $sel = $("#selectPaciente");
      if (!$sel.length) return;
    
      this.mostrarLoading();
    
      // reset seguro
      try { if ($sel.data("select2")) $sel.select2("destroy"); } catch (_) {}
      $sel.prop("disabled", true).html('<option value="">Carregando...</option>');
    
      const finalize = () => {
        $sel.prop("disabled", false);
        try { this.esconderLoading(); } catch (_) {}
      };

      try {
        const sql = `SELECT DISTINCT
        COLIGADA AS CODCOLIGADA,
        PRONTUARIO,
        CODPACIENTE,
        CODATENDIMENTO,
        PARCIAL AS SEQPARCIAL,
        NOMEPACIENTE,
        CONVENIO AS SIGLA
FROM ZMD_BC_CONTAS
ORDER BY NOMEPACIENTE, COLIGADA, PRONTUARIO, CODPACIENTE, CODATENDIMENTO, PARCIAL, CONVENIO;`;
        console.log("[carregarPacientesInput] SQL executada:\n", sql);

        const rows = this.queryRMConfig(sql) || [];
        if (!rows.length) {
          $sel.html('<option value="">Nenhum paciente encontrado</option>');
          finalize();
          return;
        }

        const seen = new Set();
        const pacientes = [];
        for (let i = 0; i < rows.length; i++) {
          const r = rows[i] || {};
          const key = [r.CODCOLIGADA, r.CODPACIENTE, r.CODATENDIMENTO, r.SEQPARCIAL].join("|");
          if (!seen.has(key)) { seen.add(key); pacientes.push(r); }
        }

        $sel.empty().append('<option value="">Selecione uma Conta em Elaboração</option>');

        const CHUNK = 400;
        let idx = 0;

        const appendChunk = () => {
          const end = Math.min(idx + CHUNK, pacientes.length);
          const frag = document.createDocumentFragment();

          for (let j = idx; j < end; j++) {
            const p = pacientes[j] || {};
            const opt = document.createElement("option");

            opt.value = String(p.CODPACIENTE || "");
            opt.text  =
              `${p.NOMEPACIENTE || ""} | Pront: ${p.PRONTUARIO || ""}` +
              ` | Cod Paciente: ${p.CODPACIENTE || ""}` +
              ` | Coligada: ${p.CODCOLIGADA || ""}` +
              ` | Atendimento: ${p.CODATENDIMENTO || ""}` +
              ` | Parcial: ${p.SEQPARCIAL || ""}`;

            opt.setAttribute("data-nomepaciente",   p.NOMEPACIENTE   || "");
            opt.setAttribute("data-prontuario",     p.PRONTUARIO     || "");
            opt.setAttribute("data-coligada",       p.CODCOLIGADA    || "");
            opt.setAttribute("data-codatendimento", p.CODATENDIMENTO || "");
            opt.setAttribute("data-parcial",        p.SEQPARCIAL     || "");

            frag.appendChild(opt);
          }

          $sel[0].appendChild(frag);
          idx = end;

          if (idx < pacientes.length) {
            setTimeout(appendChunk, 0);
          } else {
            try {
              $sel.select2({
                placeholder: "Selecione uma Conta em Elaboração",
                allowClear: true,
                minimumInputLength: 0,
                width: "100%"
              });
            } catch (e) { console.warn("select2 init:", e); }
            finalize();
          }
        };

        appendChunk();
      } catch (err) {
        console.error("[carregarPacientesInput] Erro ao carregar pacientes via SQL:", err);
        $sel.html('<option value="">Erro ao carregar pacientes</option>');
        finalize();
      }
    },
    selecionarTodos(checkbox) {
        document.querySelectorAll("#rulesTable .ruleCheckbox").forEach(cb => cb.checked = checkbox.checked);
        document.querySelector("#rulesTable").classList.toggle("selecionado", checkbox.checked);
    },
   
  
    carregarRegrasAtivas() {
      this.mostrarLoading();
    
      try {
        
                // Consulta SQL direta em vez de dataset
        const sql = `
        WITH RESAGG AS (
          SELECT
            IDREGRA,
            COUNT(*) AS TOTALOCORRENCIAS
          FROM ZMD_BC_RESULTADO
          WHERE ${this.FILTRO_PADRAO}
          AND STATUS IS NULL
          GROUP BY IDREGRA
        )
        SELECT
          R.IDREGRAS,
          R.TITULOREGRA,
          R.DESCRICAOREGRA,
          ISNULL(
            STUFF((
              SELECT '; ' + D.EMAIL
              FROM (
                SELECT DISTINCT E.EMAIL
                FROM ZMD_BC_RELEMAILSREGRAS ER
                JOIN ZMD_BC_EMAILSREGRAS E
                  ON E.IDEMAIL = ER.IDEMAIL
                WHERE ER.IDREGRAS = R.IDREGRAS
              ) D
              ORDER BY D.EMAIL
              FOR XML PATH(''), TYPE
            ).value('.', 'NVARCHAR(MAX)'), 1, 2, '')
          , '') AS EMAILS,
          ISNULL(
            STUFF((
              SELECT '; ' + D.DESCRICAO
              FROM (
                SELECT DISTINCT C.DESCRICAO
                FROM ZMD_BC_RELCLASSIFICACAOREGRA REL
                JOIN ZMD_BC_CLASSIFICACAOREGRAS C
                  ON C.IDCLASSIFICACAO = REL.IDCLASSIFICACAO
                WHERE REL.IDREGRAS = R.IDREGRAS
              ) D
              ORDER BY D.DESCRICAO
              FOR XML PATH(''), TYPE
            ).value('.', 'NVARCHAR(MAX)'), 1, 2, '')
          , '') AS CLASSIFICACAO,
          ISNULL(RA.TOTALOCORRENCIAS, 0) AS TOTALOCORRENCIAS
        FROM ZMD_BC_REGRAS R
        LEFT JOIN RESAGG RA ON RA.IDREGRA = R.IDREGRAS
        WHERE ATIVO = 1
        ORDER BY R.IDREGRAS;`;
        
        console.log("Executando consulta SQL direta..." + sql);
        const data = this.queryRMConfig(sql);
        console.log("Consulta SQL retornou:", data);
        
        const tbody = document.querySelector("#rulesTable tbody");
        tbody.innerHTML = "";
    
        // ---------- monta linhas ----------
        (data || []).forEach((rule, index) => {
          
          const tr = document.createElement("tr");
          tr.dataset.idregra = rule.IDREGRAS || "";
      
          const natureza = (rule.CLASSIFICACAO || "").trim();
          tr.innerHTML = `
          <td style="text-align:center;">
            <input type="checkbox" class="ruleCheckbox" title="Selecionar regra">
          </td>
          <td style="text-align:center;">
            <button class="btn btn-link btnShowQuery" data-idregra="${rule.IDREGRAS}"
              data-tituloregra="${rule.TITULOREGRA || ''}" 
              data-totalocorrencias="${rule.TOTALOCORRENCIAS || 0}" style="padding:0"
              title="Visualizar dados da regra">
            <i class="fluigicon fluigicon-eye-open icon-md" aria-hidden="true"></i>
            </button>
          </td>
          <td style="text-align:center; width:60px;">${rule.IDREGRAS || ""}</td>
          <td title="${escHtml(rule.DESCRICAOREGRA || rule.TITULOREGRA || '')}">${rule.TITULOREGRA || ""}</td>
          <td title="${natureza}">${natureza}</td>
          <td style="text-align:center;">${rule.TOTALOCORRENCIAS || 0}</td>
          <td style="text-align:center;">
            <button class="btn btn-default btn-xs btnEditEmail"
              title="${rule.EMAILS || 'Nenhum e-mail cadastrado'}"
              style="border: none; background: none;"
              onclick="MyWidget.abrirEditorEmails('${rule.IDREGRAS}', '${rule.EMAILS || ''}', updatedEmail => { rule.EMAIL = updatedEmail; })">
            <i class="fluigicon fluigicon-envelope icon-md"></i>
            </button>
          </td>
          `;
          tbody.appendChild(tr);
        });
        
        // ===== DEBUG: Verificar se as regras estão sendo atualizadas corretamente =====

        // ---------- DataTable + handlers ----------
        const self = this;

        
        tbody.querySelectorAll(".btnShowQuery").forEach(btn => {
          btn.addEventListener("click", function () {
            const totalOcorrencias = parseInt(this.dataset.totalocorrencias || 0, 10);
            // Removida validação que impedia abertura do modal para regras sem ocorrências
            // Agora o modal será aberto mesmo quando totalOcorrencias === 0
            self.exibirModal(this.dataset.idregra, this.dataset.tituloregra);
          });
        });
        
        const dt = this.criarOuAtualizarDataTable();
        this.bindRegraFilters(dt); // (ajustada abaixo)
      
        // restaura estado anterior
        if (this.lastBusca) dt.search(this.lastBusca);
        const $nat = $('#filterNatureza');
        if (this.lastNatureza) $nat.val(this.lastNatureza);
        dt.draw(false);
      
        // ---------- Popular filtro "Classificação" a partir da tabela RM ----------
        try {
          const classes = (this.queryRM(
          "SELECT DESCRICAO FROM ZMD_BC_CLASSIFICACAOREGRAS ORDER BY DESCRICAO;"
          ) || []).map(r => r.DESCRICAO).filter(Boolean);
      
          const selNatureza = document.getElementById("filterNatureza");
          if (selNatureza) {
            const atuais = this.lastNatureza || "";
            const opts = ['<option value="">Todas</option>']
              .concat(classes.map(n => `<option value="${escHtml(n)}">${escHtml(n)}</option>`));
            selNatureza.innerHTML = opts.join("");
            if (atuais) selNatureza.value = atuais;
          } else {
            console.error("Elemento filterNatureza não encontrado");
          }
        } catch (e) {
          console.warn("Falha ao carregar classificações globais:", e);
        }
            
      } catch (err) {
        console.error("Erro ao carregar regras ativas:", err);
        FLUIGC.toast({ message: "Erro ao carregar regras. Veja o console.", type: "danger" });
      } finally {
        this.esconderLoading();
      }
    },
    // --- AJUSTE no bindRegraFilters: agora filtro por "contém" (case-insensitive) ---
    // Função bindRegraFilters removida - versão duplicada mais simples    
    criarOuAtualizarDataTable: function(){
      if ($.fn.DataTable.isDataTable('#rulesTable')) {
      $('#rulesTable').DataTable().destroy();
      }
    
      const thead = document.querySelector("#rulesTable thead");
      const tbody = document.querySelector("#rulesTable tbody");
      if (!thead || !tbody) {
      console.error("Cabeçalho ou corpo da tabela não encontrado.");
      return null;
      }
    
      const dt = $('#rulesTable').DataTable({
      pageLength: 10,
      lengthMenu: [10, 20, 25, 50, 100],
      order: [[3, 'asc']], // 3 = Regra (padrão)
      columnDefs: [
        { targets: 0, orderable: false, searchable: false },
        { targets: 1, orderable: false, searchable: false },
        { targets: 2, orderable: true,  searchable: true  }, // ID
        { targets: 3, orderable: true,  searchable: true  }, // Regra
        { targets: 4, orderable: true,  searchable: true  }, // Natureza
        { targets: 5, orderable: true,  searchable: true  }, // Total de Ocorrências
        { targets: 6, orderable: false, searchable: false }  // Email (botão)
      ],
      // sem a caixa de busca do DataTables (usaremos #filterBusca)
      dom: "<'row'<'col-sm-12 col-md-6'l><'col-sm-12 col-md-6'>>" +
         "tr<'row'<'col-sm-12 col-md-5'i><'col-sm-12 col-md-7'p>>",
      language: {
        decimal: ",", thousands: ".",
        lengthMenu: "Exibir _MENU_ registros",
        zeroRecords: "Nenhum registro encontrado",
        info: "Exibindo _START_ a _END_ de _TOTAL_",
        infoEmpty: "Exibindo 0 a 0 de 0",
        infoFiltered: "(filtrado de _MAX_ no total)",
        paginate: { first: "Primeiro", last: "Último", next: "Próximo", previous: "Anterior" },
        processing: "Processando..."
      }
      });
    
      this.dtRules = dt; // guarda, se quiser usar depois
      return dt;
    },
    bindRegraFilters: function(dt){
      if (!dt) return;
    
      const $busca = $('#filterBusca');
      const $nat   = $('#filterNatureza');
    
      // evita duplicar handlers
      $busca.off('input.auditrules');
      $nat.off('change.auditrules');
    
      // remove filtro custom anterior (se houver)
      if (this._rulesClassFilter) {
        $.fn.dataTable.ext.search = $.fn.dataTable.ext.search.filter(fn => fn !== this._rulesClassFilter);
        this._rulesClassFilter = null;
      }
    
      // ---- highlight acento/case-insensível (reutilizada de exibirModal/abrirDetalhes) ----
      const highlightInsensitive = (text, term) => {
        const src = String(text || "");
        const t = String(term || "").trim();
        if (!t) return src;

        const strip = s => String(s || "")
          .replace(/<[^>]*>/g, "")
          .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
          .toLowerCase();

        const srcChars = Array.from(src);
        let normStr = "", map = [];
        for (let i = 0; i < srcChars.length; i++) {
          const n = strip(srcChars[i]);
          for (let j = 0; j < n.length; j++) { normStr += n[j]; map.push(i); }
        }
        const termNorm = strip(t);
        if (!termNorm) return src;

        let out = "", normIdx = 0, lastOrig = 0;
        while (true) {
          const found = normStr.indexOf(termNorm, normIdx);
          if (found === -1) break;
          const oStart = map[found];
          const oEnd   = (map[found + termNorm.length - 1] ?? (srcChars.length - 1)) + 1;
          out += src.substring(lastOrig, oStart) + '<mark>' + src.substring(oStart, oEnd) + '</mark>';
          lastOrig = oEnd;
          normIdx = found + termNorm.length;
        }
        out += src.substring(lastOrig);
        return out;
      };

      // ---- Aplicar highlights nas células da tabela de regras ----
      const applyHighlights = () => {
        const term = ($busca.val() || "").trim();
        
        if (!term) {
          // Remove highlights se não há termo de busca
          dt.rows({ page: 'current' }).every(function () {
            const $row = $(this.node());
            $row.find('td').each(function() {
              const $td = $(this);
              if ($td.find('mark').length) {
                $td.html($td.text()); // Remove tags mark mantendo o texto
              }
            });
          });
          return;
        }

        dt.rows({ page: 'current' }).every(function () {
          const $row = $(this.node());
          // Aplica highlight nas colunas de texto (ID, Regra, Classificação e Total de Ocorrências)
          for (let i = 2; i <= 5; i++) { // colunas 2 (ID), 3 (Regra), 4 (Classificação), 5 (Total de Ocorrências)
            const raw = this.data()[i];
            const td = $row.find('td').get(i);
            if (!td) {
              console.warn(`Célula não encontrada para coluna ${i}`);
              continue;
            }
            
            const highlighted = highlightInsensitive(raw, term);
            
            // Verifica se o conteúdo mudou antes de aplicar
            if (td.innerHTML !== highlighted) {
              td.innerHTML = highlighted;
            }
          }
        });
      };
    
      // Filtro custom: aceita linhas que CONTENHAM a classificação escolhida,
      // inclusive quando há múltiplas separadas por ';'
      const tableNode = dt.table().node();
      const classColIndex = 4; // coluna "Classificação" (índice 4)
    
      const containsClass = (cell, wanted) => {
        const txt = String(cell || '').toLowerCase();
        const tok = String(wanted || '').toLowerCase().trim();
        if (!tok) return true;
        
        
        // quebra por ';' (ou vírgula) e normaliza espaços
        const tokens = txt.split(/[;,]/).map(s => s.trim()).filter(Boolean);
        
        // match apenas por token exato (sem substring fallback)
        const tokenMatch = tokens.includes(tok);
        
        return tokenMatch;
      };
    
      const filterFn = (settings, data) => {
        if (settings.nTable !== tableNode) return true; // não interfere em outras tabelas
        const wanted = ($nat.val() || '').trim();
        if (!wanted) return true;
        
        const cellValue = data[classColIndex];
        const matches = containsClass(cellValue, wanted);
        
        return matches;
      };
    
      $.fn.dataTable.ext.search.push(filterFn);
      this._rulesClassFilter = filterFn;
    
      // busca global (todas as colunas) + highlight
      $busca.on('input.auditrules', debounce(() => {
        const q = ($busca.val() || "").toString();
        this.lastBusca = q;
        dt.search(q).draw(false);
        // Aplica highlight após o redraw
        setTimeout(applyHighlights, 10);
      }, 200));
    
      // seleção de classificação dispara redraw (usa filtro custom acima) + highlight
      $nat.on('change.auditrules', () => {
        const selectedValue = ($nat.val() || "").toString().trim();
        this.lastNatureza = selectedValue;
        dt.draw(false);
        // Aplica highlight após o redraw
        setTimeout(applyHighlights, 10);
      });

      // Aplica highlight quando a tabela é redesenhada
      dt.on('draw.dt', applyHighlights);
    
      // restaura valor do select (se houver) e aplica
      if (this.lastNatureza) $nat.val(this.lastNatureza);
      dt.draw(false);
    },      
// === SUBSTITUI a função que abre o modal "Nova Regra" ===
abrirModalNovaRegra: function () {
  const self = this;

  // Garante que não exista um modal antigo com o mesmo id
  try { $('#modalNovaRegraFluig').remove(); } catch (_) {}

  const modal = FLUIGC.modal({
    title  : "Nova Regra",
    id     : "modalNovaRegraFluig",
    size   : "large",
    content: `
      <style>
        #modalNovaRegraFluig .form-group{ margin-bottom:12px; }
        #modalNovaRegraFluig .help{ color:#888; font-size:12px; }
      </style>

      <div class="row">
        <div class="col-sm-12">
          <div class="form-group">
            <label for="nrTituloRegra">Título da Regra <span class="text-danger">*</span></label>
            <input type="text" id="nrTituloRegra" class="form-control" maxlength="200" placeholder="Ex.: Verificar contas sem taxa de registro">
          </div>
        </div>
        <div class="col-sm-12">
          <div class="form-group">
            <label for="nrDescricaoRegra">Descrição <span class="text-danger">*</span></label>
            <textarea id="nrDescricaoRegra" class="form-control" maxlength="500" rows="3"
                      placeholder="Descreva o que a regra deve buscar. Ex: Contas a receber sem taxa de registro"></textarea>
          </div>
        </div>
      </div>
    `,
    actions: [
      { label: "Salvar",   bind: "data-ok",     classType: "btn-primary"  }
    ]
  });

  // Botões
  const $modal = $('#modalNovaRegraFluig');
  $modal.on('click', '[data-cancel]', () => modal.remove());

  const disableBtn = (on) => {
    const $btn = $modal.find('[data-ok]');
    $btn.prop('disabled', !!on);
    return $btn;
  };

  // --- fluxo ao salvar ---
  $modal.on('click', '[data-ok]', function () {
    const $btnSalvar = disableBtn(true);
    const titulo     = ($('#nrTituloRegra').val() || '').trim();
    const descricao  = ($('#nrDescricaoRegra').val() || '').trim();

    if (!titulo || !descricao) {
      FLUIGC.toast({ message: "Preencha título e descrição.", type: "warning" });
      disableBtn(false);
      return;
    }

    // Mostra loading e espera 1s para ele realmente aparecer antes do dataset
    try { self.mostrarLoading(); } catch (_) {}
    setTimeout(() => {
      try {
      // 0) Pré-checagem de similaridade com dataset ds_agente_verif_regra_nova
      console.log("[NovaRegra] Pré-checagem: ds_agente_verif_regra_nova", descricao);
      let verifConstraints = [
      DatasetFactory.createConstraint("message", descricao, descricao, ConstraintType.MUST)
      ];
      let dsVerif;
      try {
      dsVerif = DatasetFactory.getDataset("ds_agente_verif_regra_nova", null, verifConstraints, null);
      } catch (e1) {
      console.warn("[NovaRegra] ds_agente_verif_regra_nova não encontrado sem extensão, tentando com .js", e1);
      try { dsVerif = DatasetFactory.getDataset("ds_agente_verif_regra_nova.js", null, verifConstraints, null); } catch(e2) { dsVerif = null; }
      }
      console.log("[NovaRegra] Retorno verificação:", dsVerif);

      // Exige retorno do dataset e similaridade <= 85% para poder prosseguir
      if (!(dsVerif && dsVerif.values && dsVerif.values.length)) {
      console.warn('[NovaRegra] Verificação vazia: bloqueando criação.');
      try { FLUIGC.toast({ message: 'Não foi possível validar similaridade da nova regra. Criação bloqueada.', type: 'warning' }); } catch (_) {}
      disableBtn(false);
      try { self.esconderLoading(); } catch (_) {}
      return;
      }

      const vr = dsVerif.values[0] || {};
      const raw = vr.resposta || vr.RESPOSTA || vr.json || vr.JSON || '';
      let outer;
      try { outer = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch (e) { outer = null; }

      // Muitos agentes retornam um JSON com a chave "resposta" contendo outro JSON em string.
      // Fazemos o parse em duas camadas quando aplicável.
      let obj = outer;
      if (outer && typeof outer === 'object' && outer.resposta) {
      const innerRaw = outer.resposta;
      try { obj = typeof innerRaw === 'string' ? JSON.parse(innerRaw) : innerRaw; } catch (e2) { obj = null; }
      }

      console.log('[NovaRegra] Verificação parse:', { outer, inner: obj });

      if (!(obj && (obj.similaridade != null))) {
      console.warn('[NovaRegra] Verificação sem campo similaridade: bloqueando criação.', obj);
      try { FLUIGC.toast({ message: 'Retorno de verificação inválido. Criação bloqueada.', type: 'warning' }); } catch (_) {}
      disableBtn(false);
      try { self.esconderLoading(); } catch (_) {}
      return;
      }

      let sim = parseFloat(String(obj.similaridade).replace(',', '.'));
      if (isNaN(sim)) {
      console.warn('[NovaRegra] Similaridade não numérica:', obj.similaridade);
      try { FLUIGC.toast({ message: 'Similaridade inválida. Criação bloqueada.', type: 'warning' }); } catch (_) {}
      disableBtn(false);
      try { self.esconderLoading(); } catch (_) {}
      return;
      }
      if (sim > 1) sim = sim / 100; // normaliza percentuais > 1
      const simPct = Math.round(sim * 100);
      console.log(`[NovaRegra] Avaliação: regra="${obj.regra || ''}", similaridade=${simPct}%, comparação="${obj['comparação'] || obj.comparacao || ''}"`);
      console.log(`[NovaRegra] Limite permitido de similaridade: 85%`);

      if (sim > 0.85) {
      // Bloqueia se > 85% de similaridade
      try {
      FLUIGC.message.alert({
        title: 'Regra semelhante encontrada',
        message: `Já existe uma regra semelhante cadastrada de nome ${obj['comparação'] || obj.comparacao} com ${simPct}% de similaridade. Criação bloqueada.`,
        label: 'Entendi'
      });
      } catch (_) {
      FLUIGC.toast({ message: `Semelhante: ${obj.regra || ''} (${simPct}%). Criação bloqueada.`, type: 'warning' });
      }
      disableBtn(false);
      try { self.esconderLoading(); } catch (_) {}
      return; // interrompe o fluxo de criação
      }

      // 1) Geração do SQL via ds_agente_sql (somente com similaridade <= 85%)
      console.log("[NovaRegra] Enviando ao ds_agente_sql:", descricao);
      const constraints = [
      DatasetFactory.createConstraint("message", descricao, descricao, ConstraintType.MUST)
      ];

      const ds = DatasetFactory.getDataset("ds_agente_sql", null, constraints, null);
      console.log("[NovaRegra] Resposta ds_agente_sql:", ds);

      const row = ds && ds.values && ds.values[0];
      let sqlGerado = row && (row.resposta || row.SQL || row.sql || '').trim();

      if (!sqlGerado || !/select/i.test(sqlGerado)) {
      console.warn("[NovaRegra] SQL não gerado. Usando resposta como fallback.");
      sqlGerado = row.resposta || "Erro ao gerar SQL. Consulte o administrador.";
      }
      console.log("[NovaRegra] SQL ou resposta gerada:", sqlGerado);

      // 2) INSERT da regra no RM
      const usuarioCriacao = escSql(self.usuario || WCMAPI.userLogin || WCMAPI.userCode || '');
      const insertSQL = `
      INSERT INTO ZMD_BC_REGRAS (
      TITULOREGRA, DESCRICAOREGRA, SQLREGRA, RECCREATEDBY, RECCREATEDON, ATIVO
      ) VALUES (
      '${escSql(titulo)}',
      '${escSql(descricao)}',
      '${escSql(sqlGerado)}',
      '${usuarioCriacao}',
      GETDATE(),
      2
      )
      `;

      console.log("[NovaRegra] INSERT:", insertSQL);
      const ret = DatasetFactory.getDataset(self.DATASET_RM, [self.JDBC_RM, insertSQL], null, null);
      console.log("[NovaRegra] Resultado INSERT:", ret);

      // Memoriza aba ativa para restaurar após reload
      let tabToRestore = '#tab-config';
      try {
      const activeA = document.querySelector('.nav-tabs li.active a, .nav.nav-tabs .active a');
      const href    = activeA && (activeA.getAttribute('href') || activeA.dataset.target);
      if (href) tabToRestore = href;
      } catch (_) {}
      sessionStorage.setItem('audit_active_tab', tabToRestore);

      // Sucesso
      try { FLUIGC.toast({ message: "Regra criada com sucesso!", type: "success" }); } catch (_){}

      // Evita foco preso (warning aria-hidden/focus)
      try { if (document.activeElement) document.activeElement.blur(); } catch (_){}

      // Fechamento com fallback e reload
      const cleanupAndReload = () => {
      if (cleanupAndReload._done) return;
      cleanupAndReload._done = true;

      try { self.esconderLoading(); } catch (_){}
      try {
      document.querySelectorAll('.modal-backdrop').forEach(el => el.remove());
      document.body.classList.remove('modal-open');
      document.body.style.paddingRight = "";
      document.body.style.overflow = "";
      } catch (_){}

      // Restaura a aba
      try {
      const hash = sessionStorage.getItem('audit_active_tab') || '#tab-config';
      if (hash && hash.startsWith('#')) window.location.hash = hash;
      } catch (_){}

      window.location.reload();
      };

      // fecha modal normalmente
      $modal.one('hidden.bs.modal', cleanupAndReload);
      const safety = setTimeout(() => {
      console.warn('[NovaRegra] hidden.bs.modal não disparou — aplicando cleanup forçado.');
      cleanupAndReload();
      }, 700);

      $modal.one('hidden.bs.modal', () => clearTimeout(safety));
      setTimeout(() => { try { $modal.modal('hide'); } catch (_) { cleanupAndReload(); } }, 60);

      } catch (err) {
      console.error("[NovaRegra] Falha no salvar:", err);
      try { FLUIGC.toast({ message: "Erro ao salvar a regra.", type: "danger" }); } catch (_){}
      disableBtn(false);
      try { self.esconderLoading(); } catch (_){}
      }
    }, 1000);
  });
},

    restaurarBotao(saveButton) {
        if (saveButton) {
            saveButton.disabled = false;
            saveButton.innerHTML = 'Salvar';
        }
    },
    
    // Gerenciar botões de seleção para evolução temporal
    _bindEvolucaoTemporalButtons() {
        const buttons = document.querySelectorAll('.regra-btn');
        const selectedRegras = new Set();
        
        buttons.forEach(btn => {
            btn.addEventListener('click', () => {
                const regra = btn.getAttribute('data-regra');
                const titulo = btn.getAttribute('data-titulo');
                
                if (selectedRegras.has(regra)) {
                    // Remover da seleção
                    selectedRegras.delete(regra);
                    btn.classList.remove('btn-primary');
                    btn.classList.add('btn-default');
                } else {
                    // Adicionar à seleção
                    selectedRegras.add(regra);
                    btn.classList.remove('btn-default');
                    btn.classList.add('btn-primary');
                }
                
                this._updateEvolucaoTemporalChart(selectedRegras);
            });
        });
    },
    
    // Atualizar gráfico de evolução temporal baseado na seleção
    _updateEvolucaoTemporalChart(selectedRegras) {
        if (!this._evolucaoTemporalData || selectedRegras.size === 0) {
            // Limpar gráfico se não há seleção
            this._dbDestroy("db_line_evolucao_temporal");
            return;
        }
        
        const { regraData, datas } = this._evolucaoTemporalData;
        const datasets = [];
        
        selectedRegras.forEach(regra => {
            const data = regraData[regra];
            if (data) {
                datasets.push({
                    label: data.titulo,
                    data: datas.map(d => data.data[d] || 0),
                    borderWidth: 2,
                    fill: false,
                    tension: 0.1,
                    backgroundColor: this._getRandomColor(),
                    borderColor: this._getRandomColor()
                });
            }
        });
        
        this._dbLine("db_line_evolucao_temporal", datas, datasets);
    },
    
    // Gerenciar botões de seleção para status por regra
    _bindStatusRegraButtons() {
      const buttons = document.querySelectorAll('.regra-btn-status');
      const selectedRegras = new Set();
      
      buttons.forEach(btn => {
          btn.addEventListener('click', () => {
              const regra = btn.getAttribute('data-regra');
              const titulo = btn.getAttribute('data-titulo');
              
              if (selectedRegras.has(regra)) {
                  // Remover da seleção
                  selectedRegras.delete(regra);
                  btn.classList.remove('btn-primary');
                  btn.classList.add('btn-default');
              } else {
                  // Adicionar à seleção
                  selectedRegras.add(regra);
                  btn.classList.remove('btn-default');
                  btn.classList.add('btn-primary');
              }
              
              this._updateStatusRegraChart(selectedRegras);
          });
      });
  },
    
    // Atualizar gráfico de status por regra baseado na seleção
    _updateStatusRegraChart(selectedRegras) {
        if (!this._statusRegraData || selectedRegras.size === 0) {
            // Limpar gráfico se não há seleção
            this._dbDestroy("db_status_regras_chart");
            return;
        }
        
        const { regraData } = this._statusRegraData;
        const statuses = ['EM ANALISE', 'CORRIGIDO', 'DESCARTADO', 'FINALIZADO', 'INCONSISTENTE', 'RESOLVIDO'];
        const allDatas = new Set();
        
        // Coletar todas as datas das regras selecionadas
        selectedRegras.forEach(regra => {
            const data = regraData[regra];
            if (data) {
                Object.keys(data.data).forEach(d => allDatas.add(d));
            }
        });
        
        const datas = Array.from(allDatas).sort((a, b) => {
          // Converter datas do formato DD/MM/YYYY para objeto Date para ordenação correta
          const [dayA, monthA, yearA] = a.split('/').map(Number);
          const [dayB, monthB, yearB] = b.split('/').map(Number);
          const dateA = new Date(yearA, monthA - 1, dayA); // month - 1 porque Date usa 0-11 para meses
          const dateB = new Date(yearB, monthB - 1, dayB);
          return dateA - dateB; // Ordem cronológica: data menor à esquerda
        });
        
        // Criar datasets por STATUS (barras separadas por status em cada data)
        const datasets = [];
        
        statuses.forEach(status => {
            const color = this._dbStatusColors[status];
            if (color) {
                const data = datas.map(data => {
                    let total = 0;
                    selectedRegras.forEach(regra => {
                        const regraData = this._statusRegraData.regraData[regra];
                        if (regraData && regraData.data[data] && regraData.data[data][status]) {
                            total += regraData.data[data][status] || 0;
                        }
                      });
                      return total;
                  });
                
                datasets.push({
                    label: status, // Nome do STATUS
                    data: data,
                    backgroundColor: color,
                    borderColor: color.replace('0.8', '1'),
                    borderWidth: 1,
                    stack: `stack-${status}` // Cada status tem seu próprio stack
                });
            }
        });
        
        // Criar o gráfico com tooltip personalizado para mostrar informações da regra
        const ctx = document.getElementById("db_status_regras_chart").getContext("2d");
        this._dbDestroy("db_status_regras_chart");
        this._dbCharts["db_status_regras_chart"] = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: datas,
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Status por Regra por Data'
                    },
                    legend: { 
                        display: true,
                        position: 'top'
                    },
                    tooltip: {
                        callbacks: {
                            title: (items) => {
                                const dataIndex = items[0].dataIndex;
                                return `Data: ${datas[dataIndex]}`;
                            },
                            label: (ctx) => {
                                const status = ctx.dataset.label;
                                const valor = ctx.parsed.y;
                                
                                // Buscar regras que contribuíram para este valor
                                const regrasContribuintes = [];
                                selectedRegras.forEach(regra => {
                                    const regraData = this._statusRegraData.regraData[regra];
                                    if (regraData && regraData.data[datas[ctx.dataIndex]] && regraData.data[datas[ctx.dataIndex]][status]) {
                                        const qtd = regraData.data[datas[ctx.dataIndex]][status] || 0;
                                        if (qtd > 0) {
                                            regrasContribuintes.push(`${regraData.titulo}: ${qtd}`);
                                        }
                                    }
                                });
                                
                                if (regrasContribuintes.length > 0) {
                                    return [
                                        `${status}: ${valor}`,
                                        ...regrasContribuintes
                                    ];
                                }
                                return `${status}: ${valor}`;
                            }
                        }
                    }
                },
                scales: {
                  x: { 
                      stacked: false, // Barras não empilhadas - cada status tem sua própria barra
                      ticks: { autoSkip: false, maxRotation: 45, minRotation: 0 } 
                  },
                  y: { 
                      beginAtZero: true 
                  }
              }
            }
        });
    },
  
  // Gerenciar botões de seleção para auditor por regra
  _bindAuditorRegraButtons() {
    const buttons = document.querySelectorAll('.regra-btn-auditor');
    const selectedRegras = new Set();
    
    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        const regra = btn.getAttribute('data-regra');
        const titulo = btn.getAttribute('data-titulo');
        
        if (selectedRegras.has(regra)) {
          // Remover da seleção
          selectedRegras.delete(regra);
          btn.classList.remove('btn-primary');
          btn.classList.add('btn-default');
        } else {
          // Adicionar à seleção
          selectedRegras.add(regra);
          btn.classList.remove('btn-default');
          btn.classList.add('btn-primary');
        }
        
        this._updateAuditorRegraChart(selectedRegras);
      });
    });
  },
  
  // Atualizar gráfico de auditor por regra baseado na seleção
  _updateAuditorRegraChart(selectedRegras) {
    if (!this._auditorRegraData || selectedRegras.size === 0) {
      // Limpa o gráfico quando não há seleção
      this._dbDestroy("db_auditor_regras_chart");
      return;
    }

    const { regraData, titulosRegras } = this._auditorRegraData;
    const statuses = ['DESCARTADO', 'INCONSISTENTE', 'RESOLVIDO'];

    // Coletar todos os auditores das regras selecionadas
    const allAuditores = new Set();
    selectedRegras.forEach(regra => {
      const rd = regraData[regra];
      if (rd) Object.keys(rd.data).forEach(a => allAuditores.add(a));
    });
    const auditores = Array.from(allAuditores).sort();

    // Para cada regra selecionada, criamos 2 datasets (um por status) com o mesmo "stack"
    // Isso produz, para cada auditor, uma coluna por regra dividida em amarelo/azul (D/I)
    const datasets = [];
    selectedRegras.forEach(regra => {
      const rd = regraData[regra];
      if (!rd) return;

      statuses.forEach(status => {
        const color = this._dbStatusColors && this._dbStatusColors[status]
          ? this._dbStatusColors[status]
          : (status === 'DESCARTADO' ? 'rgba(255, 205, 86, 0.8)' : 'rgba(54, 162, 235, 0.8)');

        const data = auditores.map(aud => (rd.data[aud] && rd.data[aud][status]) ? rd.data[aud][status] : 0);

        datasets.push({
          // Mantemos o label igual ao status; a legenda será customizada para ficar fixa em 2 itens
          label: status,
          data,
          backgroundColor: color,
          borderColor: color.replace('0.8', '1'),
          borderWidth: 1,
          // mesma pilha por regra -> uma coluna por regra, com duas cores (D/I)
          stack: `regra-${regra}`,
          // metadados para tooltip e controle de legenda
          _statusKey: status,
          _regraId: regra,
          _regraTitulo: titulosRegras && titulosRegras[regra] ? titulosRegras[regra] : `Regra ${regra}`,
          // ajustes visuais de largura
          categoryPercentage: 0.8,
          barPercentage: 0.9
        });
      });
    });

    // Monta o gráfico
    const canvas = document.getElementById("db_auditor_regras_chart");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    this._dbDestroy("db_auditor_regras_chart");
    const self = this;
    this._dbCharts["db_auditor_regras_chart"] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: auditores,
        datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: 'Auditor por Status por Regra'
          },
          legend: {
            display: true,
            position: 'top',
            labels: {
              // Gera legendas fixas: DESCARTADO, INCONSISTENTE e RESOLVIDO
              generateLabels(chart) {
                const map = {
                  'DESCARTADO': (self._dbStatusColors && self._dbStatusColors['DESCARTADO']) || 'rgba(255, 205, 86, 0.8)',
                  'INCONSISTENTE': (self._dbStatusColors && self._dbStatusColors['INCONSISTENTE']) || 'rgba(54, 162, 235, 0.8)',
                  'RESOLVIDO': (self._dbStatusColors && self._dbStatusColors['RESOLVIDO']) || 'rgba(40, 167, 69, 0.8)'
                };
                return Object.keys(map).map((status, i) => {
                  const hidden = chart.data.datasets
                    .filter(ds => ds._statusKey === status)
                    .every(ds => ds.hidden);
                  const color = map[status];
                  return {
                    text: status,
                    fillStyle: color,
                    strokeStyle: color.replace('0.8', '1'),
                    hidden,
                    index: i
                  };
                });
              }
            },
            // Toggle global por status: esconde/mostra todos os datasets daquele status
            onClick(e, legendItem, legend) {
              const status = legendItem.text;
              const chart = legend.chart;
              const targets = chart.data.datasets.filter(ds => ds._statusKey === status);
              const allHidden = targets.every(ds => ds.hidden);
              targets.forEach(ds => { ds.hidden = !allHidden; });
              chart.update();
            }
          },
          tooltip: {
            callbacks: {
              title(items) {
                const idx = items[0].dataIndex;
                return `Auditor: ${auditores[idx]}`;
              },
              label(ctx) {
                const ds = ctx.dataset || {};
                const valor = ctx.parsed && typeof ctx.parsed.y === 'number' ? ctx.parsed.y : ctx.raw;
                const status = ds._statusKey || ds.label;
                const regra = ds._regraTitulo || (ds._regraId ? `Regra ${ds._regraId}` : 'Regra');
                return `${regra} — ${status}: ${valor}`;
              }
            }
          }
        },
        scales: {
          // Grupos por auditor no eixo X, múltiplas pilhas lado a lado (uma por regra)
          x: {
            stacked: false,
            ticks: { autoSkip: false, maxRotation: 45, minRotation: 0 }
          },
          // Empilhar por status dentro da mesma regra
          y: {
            stacked: true,
            beginAtZero: true
          }
        }
      }
    });
  },
    DesativarRegrasSelecionadas() {
      const selectedCheckboxes = document.querySelectorAll(".ruleCheckbox:checked");
      if (!selectedCheckboxes.length) {
        FLUIGC.toast({ message: "Nenhuma regra selecionada.", type: "warning" });
        return;
      }

      const regrasSelecionadas = Array.from(selectedCheckboxes).map(chk => {
        const tr = chk.closest("tr");
        return {
          nomeRegra: tr.querySelector("td:nth-child(3)")?.textContent || "",
          idRegra: tr.querySelector(".btnShowQuery")?.getAttribute("data-idregra")
        };
      });

      const modal = FLUIGC.modal({
        title: "Confirmação",
        content: `
          <p>Tem certeza que deseja desativar as seguintes regras?</p>
          <ul>
            ${regrasSelecionadas.map(r => `<li><strong>${r.nomeRegra}</strong></li>`).join("")}
          </ul>
        `,
        id: "confirmDesativarRegrasModal",
        actions: [
          { label: "Sim", bind: "data-confirm", classType: "btn-primary" },
          { label: "Não", bind: "data-cancel", classType: "btn-secondary" }
        ]
      });

      document.querySelector("[data-confirm]").addEventListener("click", () => {
        try {
          regrasSelecionadas.forEach(regra => {
            const updateSQL = `UPDATE ZMD_BC_REGRAS SET ATIVO = 0 WHERE IDREGRAS = ${regra.idRegra}`;
            DatasetFactory.getDataset(this.DATASET_RM, [this.JDBC_RM, updateSQL], null, null);
          });
          this.carregarRegrasAtivas();
          FLUIGC.toast({ message: "Regras desativadas com sucesso.", type: "success" });
        } catch (err) {
          console.error("Erro ao desativar regras:", err);
          FLUIGC.toast({ message: "Erro ao desativar regras. Veja o console.", type: "danger" });
        } finally {
          modal.remove();
        }
      });

      document.querySelector("[data-cancel]").addEventListener("click", () => modal.remove());
    },
    // ====================== EXIBIR MODAL (LISTA) ======================
    exibirModal(idRegra, regraNome) {
      const now = () => (window.performance && performance.now) ? performance.now() : Date.now();
      const Timer = (() => { const rows=[]; return {
        start(lbl){ return { lbl, t: now() }; },
        end(m){ const ms = now()-m.t; rows.push([m.lbl, ms.toFixed(1)+' ms']); return ms; },
        dump(){ try{console.table(rows);}catch(_){} }
      }})();
    
      // busca sem acento / case
      if (!$.fn.dataTable._accentNeutralizerAdded) {
        $.fn.dataTable._accentNeutralizerAdded = true;
        const strip = (s) => String(s || "")
          .replace(/<[^>]*>/g, "")
          .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
          .toLowerCase();
        $.fn.dataTable.ext.type.search.string = strip;
        $.fn.dataTable.ext.type.search.html   = strip;
      }
    
      const highlightInsensitive = (text, term) => {
        const src = String(text ?? "");
        const t = String(term || "").trim();
        if (!t) return src;
        const strip = s => String(s || "")
          .replace(/<[^>]*>/g, "")
          .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
          .toLowerCase();
        const srcChars = Array.from(src);
        let normStr = "", map = [];
        for (let i = 0; i < srcChars.length; i++) {
          const n = strip(srcChars[i]);
          for (let j = 0; j < n.length; j++) { normStr += n[j]; map.push(i); }
        }
        const termNorm = strip(t);
        if (!termNorm) return src;
        let out = "", normIdx = 0, lastOrig = 0;
        while (true) {
          const found = normStr.indexOf(termNorm, normIdx);
          if (found === -1) break;
          const oStart = map[found];
          const oEnd   = (map[found + termNorm.length - 1] ?? (srcChars.length - 1)) + 1;
          out += src.substring(lastOrig, oStart) + '<mark>' + src.substring(oStart, oEnd) + '</mark>';
          lastOrig = oEnd;
          normIdx = found + termNorm.length;
        }
        out += src.substring(lastOrig);
        return out;
      };
    
      this.mostrarLoading();
    
      setTimeout(() => {
        const tAll = Timer.start("exibirModal");
        try {
          // ===== 1) Consulta SQL =====
          const t1 = Timer.start("queryRM SQL direta");
          const sql = `
            SELECT
              IDREGRA,
              JSON_VALUE(RESULTADO, '$.ocorrencia.COLIGADA')       AS COLIGADA,
              JSON_VALUE(RESULTADO, '$.ocorrencia.PRONTUARIO')     AS PRONTUARIO,
              JSON_VALUE(RESULTADO, '$.ocorrencia.CODPACIENTE')    AS CODPACIENTE,
              JSON_VALUE(RESULTADO, '$.ocorrencia.CODATENDIMENTO') AS CODATENDIMENTO,
              JSON_VALUE(RESULTADO, '$.ocorrencia.PARCIAL')        AS PARCIAL,
              JSON_VALUE(RESULTADO, '$.ocorrencia.NOMEPACIENTE')   AS NOMEPACIENTE,
              COUNT(*) AS TOTAL,
              SUM(CASE WHEN STATUS = 'D' THEN 1 ELSE 0 END) AS TOTAL_DESCARTADOS,
              SUM(CASE WHEN STATUS = 'I' THEN 1 ELSE 0 END) AS TOTAL_INCONSISTENTES,
              SUM(CASE WHEN STATUS = 'R' THEN 1 ELSE 0 END) AS TOTAL_RESOLVIDOS
            FROM ZMD_BC_RESULTADO
            WHERE ${this.FILTRO_PADRAO}
              AND IDREGRA = ${idRegra}
            GROUP BY 
              IDREGRA,
              JSON_VALUE(RESULTADO, '$.ocorrencia.COLIGADA'),
              JSON_VALUE(RESULTADO, '$.ocorrencia.PRONTUARIO'),
              JSON_VALUE(RESULTADO, '$.ocorrencia.CODPACIENTE'),
              JSON_VALUE(RESULTADO, '$.ocorrencia.CODATENDIMENTO'),
              JSON_VALUE(RESULTADO, '$.ocorrencia.PARCIAL'),
              JSON_VALUE(RESULTADO, '$.ocorrencia.NOMEPACIENTE')
            ORDER BY JSON_VALUE(RESULTADO, '$.ocorrencia.NOMEPACIENTE');`;
          console.group("[exibirModal] SQL (lista resumo)");
          console.log("[exibirModal] SQL final (modal registros):\n", sql);
          console.groupEnd();
          const rows = this.queryRMConfig(sql);
          Timer.end(t1);
          console.log("[exibirModal] Registros retornados:", (rows||[]).length);
    
          // ===== 2) Modal FLUIG =====
          const t2 = Timer.start("montagem modal");
            const modalContent = `
            <div class="modal-tools" style="margTain-bottom:10px; display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap;">
              <div class="tools-left" style="display:flex; align-items:center; gap:16px; flex-wrap:wrap;">
                <label class="chk-inline"><input type="checkbox" id="chkShowFinalizadas"><span>Exibir contas finalizadas</span></label>
              </div>
              <div class="tools-right" style="display:flex; align-items:center; gap:10px;">
              <div class="btn-group">
                <button type="button" class="btn btn-default dropdown-toggle" data-toggle="dropdown">
                Exportar <span class="caret"></span>
                </button>
                <ul class="dropdown-menu dropdown-menu-right">
                <li><a href="#" id="btnExpQueryPdf">PDF</a></li>
                <li><a href="#" id="btnExpQueryXlsx">XLSX</a></li>
                </ul>
              </div>
              </div>
            </div>
            <div style="overflow-x:auto; max-height:70vh;">
              <table id="dtQueryResults" class="table table-striped table-bordered" style="width:100%">
              <thead>
                <tr>
                <th>COLIGADA</th>
                <th>PRONTUÁRIO</th>
                <th>PACIENTE</th>
                <th>ATEND.</th>
                <th>PARCIAL</th>
                <th>NOME</th>
                <th>QTD</th>
                <th>DESCARTADOS</th>
                <th>INCONSISTENTES</th>
                <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                ${!(rows && rows.length) ? '<tr><td colspan="11" class="text-center text-muted">Nenhuma ocorrência encontrada para esta regra na data atual.</td></tr>' : ''}
              </tbody>
              </table>
            </div>`;
          FLUIGC.modal({ title: `Regra ${regraNome}`, content: modalContent, id: "queryResultsModal", size: "full" });
    
          if (!document.getElementById('dt-header-fixes-lista')) {
            const st = document.createElement('style');
            st.id = 'dt-header-fixes-lista';
            st.textContent = `
              #queryResultsModal .dt-head-left,
              #queryResultsModal .dt-head-right { margin-bottom: 8px; }
              #queryResultsModal .dataTables_length label,
              #queryResultsModal .dataTables_filter label { margin: 0; }
              #queryResultsModal .dataTables_filter { text-align: right !important; }
              #queryResultsModal mark { background:#ffe58f; padding:0 .1em; }
              .chk-inline{ display:inline-flex; align-items:center; gap:6px; margin:0 16px 0 0; white-space:nowrap; line-height:1.2; }
              .chk-inline input{ position:static; margin:0; }
              .chk-inline span{ display:inline-block; }
              .conta-finalizada { color: #28a745; font-size: 14px; margin-left: 8px; vertical-align: middle; display: inline-block; animation: pulse 2s infinite; }
              @keyframes pulse { 0% { transform: scale(1); } 50% { transform: scale(1.1); } 100% { transform: scale(1); } }
            `;
            document.head.appendChild(st);
          }
          Timer.end(t2);

          // Ajuste dinâmico do cabeçalho: inserir coluna 'RESOLVIDOS' antes de 'Ações' se faltar
          try {
            const theadRow = document.querySelector('#dtQueryResults thead tr');
            if (theadRow && theadRow.children && theadRow.children.length === 10) {
              const lastTh = theadRow.lastElementChild; // Ações
              const th = document.createElement('th');
              th.textContent = 'RESOLVIDOS';
              theadRow.insertBefore(th, lastTh);
            }
            // Corrigir colspan do placeholder (quando não há linhas)
            const placeholder = document.querySelector('#dtQueryResults tbody tr td[colspan]');
            if (placeholder) placeholder.setAttribute('colspan', '11');
          } catch(e) { console.warn('Falha ao ajustar cabeçalho RESOLVIDOS:', e); }
    
          // ===== 3) Dados / filtros =====
          const masterRows = (rows || []).map(r => {
            const C=r.COLIGADA, P=r.CODPACIENTE, A=r.CODATENDIMENTO, S=r.PARCIAL;
            const total = parseInt(r.TOTAL || 0, 10);
            const d = parseInt(r.TOTAL_DESCARTADOS || 0, 10);
            const i = parseInt(r.TOTAL_INCONSISTENTES || 0, 10);
            const resolvidos = parseInt(r.TOTAL_RESOLVIDOS || 0, 10);
            const finalizada = (d + i + resolvidos) === total && total > 0;
            const nomeComIcone = finalizada 
              ? `${r.NOMEPACIENTE || ""} <span class="conta-finalizada" title="Conta Finalizada">✅</span>`
              : r.NOMEPACIENTE || "";
            return [
              C || "", r.PRONTUARIO || "", P || "", A || "", S || "", nomeComIcone,
              total, d, i, resolvidos,
              `<a href="#" class="detalhe-prescricao"
                data-codcoligada="${C||''}" data-codpaciente="${P||''}"
                data-codatendimento="${A||''}" data-seqparcial="${S||''}"
                data-idregra="${r.IDREGRA||''}"
                title="Ver Detalhes"><i class="fluigicon fluigicon-eye-open icon-md"></i></a>`
            ];
          });
    
          const getFilteredRows = () => {
            const showFinalizadas = $('#chkShowFinalizadas').prop('checked');
            return masterRows.filter(row => {
              const qtd = +row[6]||0, d = +row[7]||0, i = +row[8]||0, resolvidos = +row[9]||0;
              const resolved = (d + i + resolvidos) === qtd && qtd > 0;
              return resolved ? showFinalizadas : true;
            });
          };
    
          // ===== 4) DataTable =====
          if ($.fn.DataTable.isDataTable('#dtQueryResults')) $('#dtQueryResults').DataTable().destroy();
          const dt = $('#dtQueryResults').DataTable({
            data: getFilteredRows(),
            deferRender: true,
            processing: true,
            pageLength: 20,
            lengthMenu: [20, 25, 50, 100, 250],
            order: [[5, 'asc']],
            language: {
              decimal:',', thousands:'.',
              lengthMenu: 'Exibir _MENU_ registros',
              zeroRecords: 'Nenhum registro',
              info: 'Exibindo _START_ a _END_ de _TOTAL_',
              infoEmpty: 'Exibindo 0 a 0 de 0',
              infoFiltered: '(filtrado de _MAX_ no total)',
              search: 'Buscar:',
              paginate: { first:'Primeiro', last:'Último', next:'Próximo', previous:'Anterior' },
              processing: 'Processando...'
            },
            dom:
              "<'row'<'col-sm-12 col-md-6 dt-head-left'l>" +
              "<'col-sm-12 col-md-6 dt-head-right text-right'f>>" +
              "tr<'row'<'col-sm-12 col-md-5'i><'col-sm-12 col-md-7'p>>",
            columns: [
              null,null,null,null,null,null,
              { className:'text-right' },
              { className:'text-right' },
              { className:'text-right' },
              { className:'text-right' },
              { orderable:false, searchable:false, className:'text-center' }
            ]
          });
          $('#queryResultsModal .dataTables_length select')
            .addClass('form-control input-sm')
            .css({ width:'100px', display:'inline-block', margin:'0 6px' });
          $('#queryResultsModal .dataTables_length label').css({ whiteSpace:'nowrap' });
          $('#queryResultsModal .dataTables_filter input')
            .addClass('form-control input-sm')
            .attr('placeholder','Buscar em todas as colunas...')
            .css({ width:'240px', display:'inline-block', marginLeft:'6px' });
    
          $('#chkShowFinalizadas').on('change', () => {
            const q = ($('#queryResultsModal .dataTables_filter input').val() || "");
            dt.clear().rows.add(getFilteredRows()).draw(false);
            $('#queryResultsModal .dataTables_filter input').val(q);
            dt.search(q).draw(false);
          });
    
          $('#dtQueryResults').on('click','a.detalhe-prescricao',(e)=>{ 
            e.preventDefault();
            const el = e.currentTarget;
            this.abrirDetalhe({
              idRegra,
              codcoligada: el.dataset.codcoligada,
              codpaciente: el.dataset.codpaciente,
              codatendimento: el.dataset.codatendimento,
              seqparcial: el.dataset.seqparcial
            });
          });
    
          const tools = this.exportGrid({
            tableSelector:'#dtQueryResults',
            filenameBase:`Regra_${(regraNome||'').trim()||idRegra}`,
            title:`Regra: ${regraNome || idRegra}`
          });
          document.getElementById('btnExpQueryPdf').addEventListener('click', e => {
            e.preventDefault();
            if (!dt.data().any()) return FLUIGC.toast({message:'Sem dados para exportar.', type:'warning'});
            tools.exportPdf();
          });
          document.getElementById('btnExpQueryXlsx').addEventListener('click', e => {
            e.preventDefault();
            if (!dt.data().any()) return FLUIGC.toast({message:'Sem dados para exportar.', type:'warning'});
            tools.exportXlsx();
          });
    
          const applyHighlights = () => {
            const term = ($('#queryResultsModal .dataTables_filter input').val() || "").trim();
            dt.rows({ page: 'current' }).every(function () {
              const $row = $(this.node());
              for (let i = 0; i <= 9; i++) {
                const raw = this.data()[i];
                const td  = $row.find('td').get(i);
                if (!td) continue;
                td.innerHTML = highlightInsensitive(raw, term);
              }
            });
          };
          dt.on('draw.dt', applyHighlights);
          $('#queryResultsModal .dataTables_filter input').off('input.hl').on('input.hl', () => { dt.draw(false); });
    
          // ======= FLAG de alteração e LOGS =======
          let precisaRefreshAtivas = false;
          const onDetalheAplicado = (ev) => {
            console.group("[exibirModal] evento aud:detalhe-status-aplicado");
            console.log("detail:", ev && ev.detail);
            precisaRefreshAtivas = true;
            console.log("→ precisaRefreshAtivas = true (atualiza apenas o modal agora)");
            this.recarregarDadosModal(idRegra, dt, masterRows, getFilteredRows);
            console.groupEnd();
          };
          window.addEventListener("aud:detalhe-status-aplicado", onDetalheAplicado);
    
          // ======= Ao FECHAR: atualizar carregarRegrasAtivas com LOGS =======
          const tryLogDt = (label) => {
            const candidates = ['#regrasAtivasTable','#rulesActiveTable','#activeRulesTable','#tblRegrasAtivas','#rulesTable'];
            const found = candidates.find(sel => $(sel).length);
            console.log(`[exibirModal][${label}] seletor encontrado para tabela ativa:`, found || '(nenhum dos candidatos)');
            if (found) {
              const isDT = $.fn.DataTable.isDataTable(found);
              console.log(`[exibirModal][${label}] isDataTable?`, isDT);
              if (isDT) {
                try {
                  const api = $(found).DataTable();
                  console.log(`[exibirModal][${label}] rows().count():`, api.rows().count());
                } catch (e) {
                  console.warn(`[exibirModal][${label}] falha ao ler DataTable:`, e);
                }
              }
            }
          };
    
          const doAfterHidden = () => {
            console.group("[exibirModal] hidden.bs.modal");
            console.log("→ precisaRefreshAtivas:", precisaRefreshAtivas);
            try { window.removeEventListener("aud:detalhe-status-aplicado", onDetalheAplicado); } catch(_){}
    
            // failsafe backdrop/foco
            try {
              document.querySelectorAll('.modal-backdrop').forEach(el => el.remove());
              document.body.classList.remove('modal-open');
              document.body.style.paddingRight = "";
              document.body.style.overflow = "";
            } catch(_){}
    
            if (precisaRefreshAtivas) {
              console.time("[exibirModal] carregarRegrasAtivas()");
              tryLogDt("antes-refresh");
              try {
                console.log("[exibirModal] Chamando carregarRegrasAtivas(this.admin)...");
                console.log("this.admin =", this && this.admin);
                if (typeof this.carregarRegrasAtivas === 'function') {
                  this.carregarRegrasAtivas(this && this.admin);
                  console.log("[exibirModal] carregarRegrasAtivas() INVOCADA");
                } else {
                  console.warn("[exibirModal] this.carregarRegrasAtivas NÃO é função!");
                }
              } catch (e) {
                console.error("[exibirModal] erro ao chamar carregarRegrasAtivas:", e);
              } finally {
                console.timeEnd("[exibirModal] carregarRegrasAtivas()");
              }
    
              // logs pós-refresh com pequenos delays (para render do DataTable)
              setTimeout(() => tryLogDt("pos-refresh-300ms"), 300);
              setTimeout(() => tryLogDt("pos-refresh-1200ms"), 1200);
            } else {
              console.log("Nenhuma alteração detectada no detalhe. Não vou atualizar as regras ativas.");
            }
            console.groupEnd();
          };
    
          $('#queryResultsModal').one('hidden.bs.modal', doAfterHidden);
          $(document).one('hidden.bs.modal', '#queryResultsModal', doAfterHidden);
    
        } catch (err) {
          console.error("Erro na exibição de modal:", err);
          FLUIGC.toast({ message: "Erro ao buscar os dados.", type: "danger" });
        } finally {
          this.esconderLoading();
          Timer.end(tAll); Timer.dump();
        }
      }, 100);
    },
    bindFecharPorXExibirModal(onClose) {
      // Remove qualquer binding anterior para evitar duplicidade
      $(document).off('click.audit.fecharExibir');
    
      // Captura EXCLUSIVAMENTE o X do exibirModal:
      // - id fixo: #queryResultsModal
      // - atributo exclusivo mostrado no seu HTML: [data-queryresultmodal]
      // - botão do cabeçalho: .modal-header > button.close[data-dismiss="modal"]
      $(document).on(
        'click.audit.fecharExibir',
        '#queryResultsModal[data-queryresultmodal] .modal-header > button.close[data-dismiss="modal"]',
        (e) => {
          console.log('[exibirModal] X clicado no cabeçalho do queryResultsModal');
    
          const $modal = $(e.currentTarget).closest('#queryResultsModal');
          let finalizou = false;
    
          const doClose = (src) => {
            if (finalizou) return;
            finalizou = true;
            console.log(`[exibirModal] finalizando após clique no X (${src})`);
    
            // Limpa binding do clique do X
            $(document).off('click.audit.fecharExibir');
    
            // Chama o callback informado (ex.: carregarRegrasAtivas)
            try { typeof onClose === 'function' && onClose(); } catch (err) {
              console.error('[exibirModal] erro no onClose:', err);
            }
          };
    
          // Preferencial: aguardar o modal ficar oculto
          $modal.one('hidden.bs.modal', () => doClose('hidden.bs.modal'));
    
          // Fallback: se por algum motivo o hidden não vier, garante em ~400ms
          setTimeout(() => { doClose('fallback-400ms'); }, 400);
        }
      );
    },    
    // ====================== ABRIR DETALHE (CHILD MODAL) ======================
    abrirDetalhe(filtros) {
      this.mostrarLoading();

      const hasVal = v => v !== null && v !== undefined && String(v).trim() !== "";
      const escSql = s => String(s || "").replace(/'/g, "''");
      const norm   = v => {
        if (v === null || v === undefined) return "";
        if (typeof v === "string" && v.trim().toLowerCase() === "null") return "";
        return v;
      };
      const fmtDateTimeBR = (d) =>
        new Date(d).toLocaleString("pt-BR", { day:"2-digit", month:"2-digit", year:"numeric", hour:"2-digit", minute:"2-digit" });

      // --- rótulo amigável para exibição (nunca mostrar D/I)
      const displayStatus = (code) => {
        if (code === "D") return "Descartado";
        if (code === "I") return "Inconsistente";
        if (code === "R") return "Resolvido";
        return "";
      };

      // UPDATE direto
      const salvarStatus = (hash, observacao, status) => new Promise((resolve, reject) => {
        if (!hasVal(hash) || !hasVal(observacao) || !hasVal(status)) {
          return reject(new Error("hash, status e observação são obrigatórios"));
        }
        try {
          const sql = `
            UPDATE ZMD_BC_RESULTADO
              SET STATUS = '${escSql(status)}',
                  OBSERVACAO = '${escSql(observacao)}',
                  DATAALTERACAO = GETDATE(),
                  USUARIOALTERACAO = '${escSql(WCMAPI.userLogin)}'
            WHERE HASHRESULTADO = '${escSql(hash)}'
              AND ${MyWidget.FILTRO_PADRAO}
          `;
          console.log("[SQL][UPDATE]:\n", sql);
          DatasetFactory.getDataset(MyWidget.DATASET_RM, [MyWidget.JDBC_RM, sql], null, null);
          resolve({ ok: true });
        } catch (err) { reject(err); }
      });

      // ---------- Dimmer interno no modal anterior (ESCURECER) ----------
      function getPrevModal() {
        const $mods = $('.modal:visible');
        const $prev = $mods.length ? $mods.last() : $();
        return $prev;
      }
      function attachInnerDimmer($prev, newModalId) {
        if (!$prev || !$prev.length) return null;
        const prevId = $prev.attr('id') || 'modal-sem-id';
        const dimId  = `aud-dim-on-${prevId}-by-${newModalId}`;

        if (!$prev.data('aud_prev_pos'))      $prev.data('aud_prev_pos', $prev.css('position'));
        if (!$prev.data('aud_prev_overflow')) $prev.data('aud_prev_overflow', $prev.css('overflow'));

        $prev.find(`#${dimId}`).remove();

        if (!/fixed|relative|absolute/.test(String($prev.css('position')))) {
          $prev.css('position', 'fixed');
        }
        $prev.css('overflow', 'hidden');

        const z = parseInt($prev.css('z-index')) || 1050;
        const $dim = $('<div/>', { id: dimId })
          .css({
            position: 'absolute',
            top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,.45)',
            zIndex: z + 5,
            pointerEvents: 'auto'
          });
        $prev.append($dim);
        return dimId;
      }
      function removeInnerDimmer(newModalId) {
        const sel = `[id^="aud-dim-on-"][id$="-by-${newModalId}"]`;
        const $d = $(sel);
        if ($d.length) {
          const $prev = $d.closest('.modal');
          $d.remove();
          if ($prev && $prev.length) {
            const prevPos = $prev.data('aud_prev_pos');
            const prevOv  = $prev.data('aud_prev_overflow');
            if (prevPos !== undefined) $prev.css('position', prevPos);
            if (prevOv  !== undefined) $prev.css('overflow', prevOv);
            $prev.removeData('aud_prev_pos aud_prev_overflow');
          }
        }
        if ($('.modal:visible').length) $('body').addClass('modal-open');
        else $('body').removeClass('modal-open');
      }

      // ---------- Busca sem acento e sem case (global DataTables) ----------
      if (!$.fn.dataTable._accentNeutralizerAdded) {
        $.fn.dataTable._accentNeutralizerAdded = true;
        const strip = (s) => String(s || "")
          .replace(/<[^>]*>/g, "")
          .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
          .toLowerCase();
        $.fn.dataTable.ext.type.search.string = strip;
        $.fn.dataTable.ext.type.search.html   = strip;
      }

      // ---------- Highlight (acento/case-insensível) ----------
      const highlightInsensitive = (text, term) => {
        const src = String(text || "");
        const t = String(term || "").trim();
        if (!t) return src;

        const strip = s => String(s || "")
          .replace(/<[^>]*>/g, "")
          .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
          .toLowerCase();

        const srcChars = Array.from(src);
        let normStr = "", map = [];
        for (let i = 0; i < srcChars.length; i++) {
          const n = strip(srcChars[i]);
          for (let j = 0; j < n.length; j++) { normStr += n[j]; map.push(i); }
        }
        const termNorm = strip(t);
        if (!termNorm) return src;

        let out = "", normIdx = 0, lastOrig = 0;
        while (true) {
          const found = normStr.indexOf(termNorm, normIdx);
          if (found === -1) break;
          const oStart = map[found];
          const oEnd   = (map[found + termNorm.length - 1] ?? (srcChars.length - 1)) + 1;
          out += src.substring(lastOrig, oStart) + '<mark>' + src.substring(oStart, oEnd) + '</mark>';
          lastOrig = oEnd;
          normIdx = found + termNorm.length;
        }
        out += src.substring(lastOrig);
        return out;
      };

      try {
        setTimeout(() => {
          // 1) filtros obrigatórios
          const idRegra        = hasVal(filtros.idRegra)        ? String(filtros.idRegra)        : "";
          const codcoligada    = hasVal(filtros.codcoligada)    ? String(filtros.codcoligada)    : "";
          const codpaciente    = hasVal(filtros.codpaciente)    ? String(filtros.codpaciente)    : "";
          const codatendimento = hasVal(filtros.codatendimento) ? String(filtros.codatendimento) : "";
          const seqparcial     = hasVal(filtros.seqparcial)     ? String(filtros.seqparcial)     : "";

          if (!idRegra || !codcoligada || !codpaciente || !codatendimento || !seqparcial) {
            FLUIGC.toast({ message: "Filtros insuficientes para abrir os detalhes.", type: "warning" });
            this.esconderLoading();
            return;
          }

          const sqlSelect = `
            WITH RESULTADO AS (
            SELECT
                R.IDREGRA,
                JSON_VALUE(R.RESULTADO, '$.ocorrencia.COLIGADA')       AS COLIGADA,
                JSON_VALUE(R.RESULTADO, '$.ocorrencia.PRONTUARIO')     AS PRONTUARIO,
                JSON_VALUE(R.RESULTADO, '$.ocorrencia.CODPACIENTE')    AS CODPACIENTE,
                JSON_VALUE(R.RESULTADO, '$.ocorrencia.CODATENDIMENTO') AS CODATENDIMENTO,
                JSON_VALUE(R.RESULTADO, '$.ocorrencia.PARCIAL')        AS PARCIAL,
                JSON_VALUE(R.RESULTADO, '$.ocorrencia.NOMEPACIENTE')   AS NOMEPACIENTE,
                R.RESULTADO AS DETALHES,
                R.STATUS,
                R.OBSERVACAO,
                R.HASHRESULTADO,
                R.DATAEXECUCAO,
                CONVERT(VARCHAR, R.DATAALTERACAO, 103) + ' ' + CONVERT(VARCHAR, R.DATAALTERACAO, 108) AS DATAALTERACAO,
                R.USUARIOALTERACAO,
                R.REGISTRO
            FROM ZMD_BC_RESULTADO AS R
            WHERE R.IDREGRA = ${escSql(idRegra)}
            )
            SELECT *
            FROM RESULTADO
            WHERE COLIGADA = ${escSql(codcoligada)}
            AND CODPACIENTE = ${escSql(codpaciente)}
            AND CODATENDIMENTO = ${escSql(codatendimento)}
            AND PARCIAL = ${escSql(seqparcial)}
            AND ${MyWidget.FILTRO_PADRAO}
          `;
          console.log("[SQL][SELECT detalhes]:\n", sqlSelect);

          const dsDet = DatasetFactory.getDataset(MyWidget.DATASET_RM, [MyWidget.JDBC_RM, sqlSelect], null, null);
          const detalhesRaw = (dsDet && dsDet.values) ? dsDet.values : [];

          if (!detalhesRaw.length) {
            FLUIGC.toast({ message: "Sem dados para este grupo.", type: "warning" });
            this.esconderLoading();
            return;
          }

          // 2) colunas dinâmicas
          const detKeysSet = new Set();
          detalhesRaw.forEach(r => {
            let parsed; try { parsed = JSON.parse(r.DETALHES || "{}"); } catch(_) { parsed = {}; }
            const detalhesObj = (parsed && parsed.detalhes) ? parsed.detalhes : {};
            Object.keys(detalhesObj || {}).forEach(k => detKeysSet.add(k));
          });

          const CAMPOS = ["STATUS", "OBSERVACAO", ...Array.from(detKeysSet), "DATAALTERACAO", "USUARIOALTERACAO"];

          const baseAll = detalhesRaw.map(r => {
            let parsed; try { parsed = JSON.parse(r.DETALHES || "{}"); } catch(_) { parsed = {}; }
            const detalhesObj = (parsed && parsed.detalhes) ? parsed.detalhes : {};
            const statusCode = norm(r.STATUS || "");
            const row = {
              HASHRESULTADO: String(r.HASHRESULTADO || ""),
              DATAEXECUCAO:  norm(r.DATAEXECUCAO || ""),
              STATUS_CODE:   statusCode,                 // interno (D/I)
              STATUS:        displayStatus(statusCode),  // rótulo de exibição
              OBSERVACAO:    norm(r.OBSERVACAO || ""),
              DATAALTERACAO: norm(r.DATAALTERACAO || ""),
              USUARIOALTERACAO: norm(r.USUARIOALTERACAO || "")
            };
            CAMPOS.forEach(k => {
              if (["STATUS", "OBSERVACAO", "DATAALTERACAO", "USUARIOALTERACAO"].includes(k)) return;
              row[k] = norm(detalhesObj[k]);
            });
            return row;
          });

          // 3) UI
          const detId = "modalDetalhesPrescricao";
          const modalContent = `
            <div class="form-inline" style="margin-bottom:10px; display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap;">
              <div>
                <label class="chk-inline"><input type="checkbox" id="chkDescartados"><span>Exibir Descartados</span></label>
                <label class="chk-inline"><input type="checkbox" id="chkInconsistentes"><span>Exibir Inconsistentes</span></label>
                <label class="chk-inline"><input type="checkbox" id="chkResolvidos"><span>Exibir Resolvidos</span></label>
              </div>
              <div class="btn-group">
                <button type="button" class="btn btn-default dropdown-toggle" data-toggle="dropdown">
                  Exportar <span class="caret"></span>
                </button>
                <ul class="dropdown-menu dropdown-menu-right">
                  <li><a href="#" id="btnExpDetPdf">PDF</a></li>
                  <li><a href="#" id="btnExpDetXlsx">XLSX</a></li>
                </ul>
              </div>
            </div>
            <div style="overflow-x:auto; max-height:65vh;">
              <table id="tblDet" class="table table-bordered table-striped" style="width:100%">
                <thead>
                  <tr>
                    <th style="width:36px;"><input type="checkbox" id="selectAllRows"></th>
                    ${CAMPOS.map(c => `<th>${c}</th>`).join('')}
                  </tr>
                </thead>
                <tbody></tbody>
              </table>
            </div>
            <div class="modal-footer" style="display:flex; gap:8px; justify-content:flex-end;">
              <button class="btn btn-warning" id="btnDescartar">Descartar</button>
              <button class="btn btn-info" id="btnInconsistente">Inconsistente</button>
              <button class="btn btn-success" id="btnResolvido">Resolvido</button>
            </div>
          `;

          // CSS auxiliar (checkbox inline + header fixes)
          if (!document.getElementById('dt-header-fixes-detalhe')) {
            const st = document.createElement('style');
            st.id = 'dt-header-fixes-detalhe';
            st.textContent = `
              #${detId} .dt-head-left,
              #${detId} .dt-head-right { margin-bottom: 8px; }
              #${detId} .dataTables_length label,
              #${detId} .dataTables_filter label { margin: 0; }
              #${detId} .dataTables_filter { text-align: right !important; }
              #${detId} mark { background:#ffe58f; padding:0 .1em; }

              #${detId} .chk-inline{
                display:inline-flex; align-items:center; gap:6px; margin:0 16px 0 0;
                white-space:nowrap; line-height:1.2;
              }
              #${detId} .chk-inline input{ position:static; margin:0; }
              #${detId} .chk-inline span{ display:inline-block; }
              
              /* Estilos para indicadores de status */
              #${detId} .status-indicator {
                display: flex;
                align-items: center;
                justify-content: center;
                width: 36px;
                height: 36px;
                cursor: default;
                border-radius: 4px;
                transition: all 0.2s ease;
              }
              
              #${detId} .status-indicator:hover {
                transform: scale(1.1);
              }
              
              #${detId} .status-descartado {
                background-color: rgba(240, 173, 78, 0.15);
                border: 1px solid rgba(240, 173, 78, 0.4);
                box-shadow: 0 2px 4px rgba(240, 173, 78, 0.2);
              }
              
              #${detId} .status-inconsistente {
                background-color: rgba(91, 192, 222, 0.15);
                border: 1px solid rgba(91, 192, 222, 0.4);
                box-shadow: 0 2px 4px rgba(91, 192, 222, 0.2);
              }
              
              #${detId} .status-resolvido {
                background-color: rgba(40, 167, 69, 0.15);
                border: 1px solid rgba(40, 167, 69, 0.4);
                box-shadow: 0 2px 4px rgba(40, 167, 69, 0.2);
              }
            `;
            document.head.appendChild(st);
          }

          // escurece apenas o modal anterior
          const $prev = getPrevModal();
          attachInnerDimmer($prev, detId);

          const modalDet = FLUIGC.modal({
            title: "Detalhes",
            content: modalContent,
            id: detId,
            size: "full"
          });

          // limpeza ao fechar
          const cleanup = () => removeInnerDimmer(detId);
          $('#'+detId).on('hide.bs.modal', cleanup).on('hidden.bs.modal', cleanup);

          // DataTable
          const columns = [
            {
              data: null, orderable: false, searchable: false, width: "36px",
              render: (_data, _type, row) => {
                const statusCode = row.STATUS_CODE;
                const hash = row.HASHRESULTADO || "";
                
                // Se for descartado, inconsistente ou resolvido, mostra sinalização colorida
                if (statusCode === "D") {
                  return `<div class="status-indicator status-descartado" title="Descartado" data-hash="${hash}">
                    <i class="fluigicon fluigicon-remove-circle" style="color: #f0ad4e; font-size: 18px; text-shadow: 0 1px 2px rgba(0,0,0,0.2);"></i>
                  </div>`;
                } else if (statusCode === "I") {
                  return `<div class="status-indicator status-inconsistente" title="Inconsistente" data-hash="${hash}">
                    <i class="fluigicon fluigicon-exclamation-sign" style="color: #5bc0de; font-size: 18px; text-shadow: 0 1px 2px rgba(0,0,0,0.2);"></i>
                  </div>`;
                } else if (statusCode === "R") {
                  // Usa o mesmo check de conta finalizada no exibirModal
                  return `<div class="status-indicator status-resolvido" title="Resolvido" data-hash="${hash}">✅</div>`;
                } else {
                  // Se não for descartado nem inconsistente, mostra checkbox normal
                  return `<input type="checkbox" class="row-selector" data-hash="${hash}">`;
                }
              }
            },
            ...CAMPOS.map(c => ({
              data: c,
              defaultContent: "",
              render: (val) => norm(val) // STATUS já vem rotulado
            }))
          ];

          const getFiltrado = (showD, showI, showR) => {
            if (showD && showI && showR) return baseAll;
            const allowed = new Set();
            if (showD) allowed.add("D");
            if (showI) allowed.add("I");
            if (showR) allowed.add("R");
            if (allowed.size === 0) return baseAll.filter(o => !hasVal(o.STATUS_CODE));
            return baseAll.filter(o => !hasVal(o.STATUS_CODE) || allowed.has(o.STATUS_CODE));
          };

          let dt = $('#tblDet').DataTable({
            data: getFiltrado(false, false, false),
            columns,
            pageLength: 20,
            lengthMenu: [20, 25, 50, 100, 250],
            order: [],
            deferRender: true,
            processing: true,
            language: {
              decimal: ",", thousands: ".",
              lengthMenu: "Exibir _MENU_ registros",
              zeroRecords: "Nenhum registro",
              info: "Exibindo _START_ a _END_ de _TOTAL_",
              infoEmpty: "Exibindo 0 a 0 de 0",
              infoFiltered: "(filtrado de _MAX_ no total)",
              search: "Buscar:",
              paginate: { first: "Primeiro", last: "Último", next: "Próximo", previous: "Anterior" },
              processing: "Processando..."
            },
            dom:
              "<'row'<'col-sm-12 col-md-6 dt-head-left'l>" +
              "<'col-sm-12 col-md-6 dt-head-right text-right'f>>" +
              "tr<'row'<'col-sm-12 col-md-5'i><'col-sm-12 col-md-7'p>>",
            scrollX: true
          });

          // header cosmetics
          const $lenWrap = $('#'+detId+' .dataTables_length');
          $lenWrap.find('select').addClass('form-control input-sm').css({ width: '100px', display: 'inline-block', margin: '0 6px' });
          $lenWrap.find('label').css({ whiteSpace: 'nowrap' });

          const $filterWrap = $('#'+detId+' .dataTables_filter');
          $filterWrap.find('input').addClass('form-control input-sm').attr('placeholder', 'Buscar em todas as colunas...').css({ width: '240px', display: 'inline-block', marginLeft: '6px' });

          // highlight
          const applyHighlights = () => {
            const term = ($('#'+detId+' .dataTables_filter input').val() || "").trim();
            dt.rows({ page: 'current' }).every(function () {
              const $row = $(this.node());
              for (let i = 1; i < CAMPOS.length + 1; i++) {
                const cell = $row.find('td').get(i);
                if (!cell) continue;
                const raw = this.data()[CAMPOS[i - 1]];
                cell.innerHTML = highlightInsensitive(raw, term);
              }
            });
          };
          dt.on('draw.dt', applyHighlights);
          $('#'+detId+' .dataTables_filter input').off('input.hl').on('input.hl', () => { dt.draw(false); });

          // filtros
          const $chkD = document.getElementById('chkDescartados');
          const $chkI = document.getElementById('chkInconsistentes');
          const $chkR = document.getElementById('chkResolvidos');
          const redraw = () => {
            const showD = $chkD.checked;
            const showI = $chkI.checked;
            const showR = $chkR.checked;
            const out = getFiltrado(showD, showI, showR);
            dt.clear().rows.add(out).draw(false);
            dt.columns.adjust();
          };
          $chkD.addEventListener('change', redraw);
          $chkI.addEventListener('change', redraw);
          $chkR.addEventListener('change', redraw);

          // export
          const tools = this.exportGrid({
            tableSelector: '#tblDet',
            filenameBase: `Detalhes_${(filtros && filtros.idRegra) || ''}`,
            title: 'Detalhes da Prescrição'
          });
          document.getElementById('btnExpDetPdf').addEventListener('click', ev => { ev.preventDefault(); if (!dt.data().any()) return FLUIGC.toast({ message:'Não há dados para exportar.', type:'warning' }); tools.exportPdf(); });
          document.getElementById('btnExpDetXlsx').addEventListener('click', ev => { ev.preventDefault(); if (!dt.data().any()) return FLUIGC.toast({ message:'Não há dados para exportar.', type:'warning' }); tools.exportXlsx(); });

          // selecionar todos
          document.getElementById("selectAllRows").addEventListener("change", (e) => {
            document.querySelectorAll("#tblDet .row-selector").forEach(cb => { cb.checked = e.target.checked; });
          });

          // marcar status
          const marcarSelecionados = (statusLabel, statusCode) => {
            const selecionados = Array.from(document.querySelectorAll("#tblDet .row-selector:checked"));
            if (!selecionados.length) return FLUIGC.toast({ message: "Selecione pelo menos uma linha.", type: "warning" });

            const m = FLUIGC.modal({
              title: `Confirmar ${statusLabel}`,
              content: `
                <div class="form-group">
                  <label for="inputObservacao">Observação:</label>
                  <textarea class="form-control" id="inputObservacao" rows="4" placeholder="Digite uma observação obrigatória..."></textarea>
                </div>`,
              id: "modalObservacaoStatus",
              actions: [
                { label: "Confirmar", bind: "data-confirm", classType: "btn-primary" },
                { label: "Cancelar",  bind: "data-cancel",  classType: "btn-secondary" }
              ]
            });

            document.querySelector("#modalObservacaoStatus [data-cancel]")?.addEventListener("click", () => m.remove());
            document.querySelector("#modalObservacaoStatus [data-confirm]")?.addEventListener("click", async () => {
              const obs = (document.getElementById("inputObservacao").value || "").trim();
              if (!obs) return FLUIGC.toast({ message: "A observação é obrigatória.", type: "warning" });

          try {
            const selectedHashes = new Set(selecionados.map(cb => cb.dataset.hash));
            for (const hash of selectedHashes) await salvarStatus(hash, obs, statusCode);

                // ===== NOVO: enviar evento para o modal principal =====
                window.dispatchEvent(new CustomEvent("aud:detalhe-status-aplicado", {
                  detail: {
                    idRegra: filtros.idRegra,
                    codcoligada: filtros.codcoligada,
                    codpaciente: filtros.codpaciente,
                    codatendimento: filtros.codatendimento,
                    seqparcial: filtros.seqparcial
                  }
                }));
                // =====================================================

                const nowBR = fmtDateTimeBR(new Date());
                baseAll.forEach(row => {
                  if (selectedHashes.has(String(row.HASHRESULTADO))) {
                    row.STATUS_CODE = statusCode;               // D/I para lógica
                    row.STATUS      = displayStatus(statusCode); // rótulo p/ exibição/export
                    row.OBSERVACAO  = obs;
                    row.USUARIOALTERACAO = WCMAPI.userLogin || row.USUARIOALTERACAO;
                    row.DATAALTERACAO    = nowBR;
                  }
                });
                redraw();

                const selAll = document.getElementById("selectAllRows");
                if (selAll) selAll.checked = false;

                FLUIGC.toast({ message: `Itens marcados como ${statusLabel.toLowerCase()}`, type: "success" });
                m.remove();
              } catch (err) {
                console.error(`Erro ao marcar como ${statusLabel}:`, err);
                FLUIGC.toast({ message: `Erro ao marcar como ${statusLabel}. Veja o console.`, type: "danger" });
              }
            });
          };

          document.getElementById("btnDescartar").addEventListener("click", () => marcarSelecionados("Descartado", "D"));
          document.getElementById("btnInconsistente").addEventListener("click", () => marcarSelecionados("Inconsistência", "I"));

          document.getElementById("btnResolvido").addEventListener("click", () => marcarSelecionados("Resolvido", "R"));
          if (typeof fitModalHeight === "function") fitModalHeight(detId);
        }, 30);
      } catch (e) {
        console.error("Erro ao abrir detalhe da prescrição:", e);
        FLUIGC.toast({ message: "Erro ao abrir os detalhes.", type: "danger" });
      } finally {
        this.esconderLoading();
      }
    },
    ExecutarRegrasPaciente: function () {
      this.mostrarLoading();
      
      const select = document.querySelector("#selectPaciente");
      const $opt = $(select).find(':selected');
      const opt  = $opt.length ? $opt[0] : (select && select.options[select.selectedIndex]);
      
      const codPaciente    = select ? select.value : "";
      const nomePaciente   = (opt && (opt.getAttribute('data-nomepaciente') || opt.dataset.nomepaciente)) || "";
      const codcoligada    = (opt && (opt.getAttribute('data-coligada')      || opt.dataset.coligada))     || "";
      const codatendimento = (opt && (opt.getAttribute('data-codatendimento')|| opt.dataset.codatendimento)) || "";
      const seqparcial     = (opt && (opt.getAttribute('data-parcial')       || opt.dataset.parcial))      || "";
      
      const hasVal  = v => v !== null && v !== undefined && String(v).trim() !== "";
      
      if (!codPaciente) {
        FLUIGC.toast({ message: "Selecione uma Conta em Elaboração.", type: "warning" });
        this.esconderLoading();
        return;
      }
      
      const selectedCheckboxes = document.querySelectorAll(".ruleCheckbox:checked");
      if (!selectedCheckboxes.length) {
        FLUIGC.toast({ message: "Nenhuma regra selecionada.", type: "warning" });
        this.esconderLoading();
        return;
      }
      
      const regrasSelecionadas = Array.from(selectedCheckboxes).map(chk => {
        const tr = chk.closest("tr");
        return {
        nomeRegra: tr.querySelector("td:nth-child(4)")?.textContent || "", // Coluna 4 = Título da Regra
        idRegra:   tr.querySelector(".btnShowQuery")?.getAttribute("data-idregra")
        };
      });
      
      // UI do modal
      const sectionsHtml = regrasSelecionadas.map(r => `
        <div class="regra-bloco" id="bloco-regra-${r.idRegra}" style="margin-bottom:28px;">
        <div class="clearfix" style="margin-bottom:8px;">
          <h4 style="font-weight:bold; display:inline-block; margin:0;">${r.nomeRegra}</h4>
          <small class="text-muted" style="margin-left:10px;">ID: ${r.idRegra}</small>
        </div>
        <div style="overflow-x:auto;">
          <table class="table table-bordered table-striped tabela-regra" id="tbl-regra-${r.idRegra}" style="width:100%">
          <thead>
            <tr>
            <th>COLIGADA</th><th>PRONTUÁRIO</th><th>PACIENTE</th><th>ATEND.</th>
            <th>PARCIAL</th><th>NOME</th><th>QTD</th><th>DESCARTADOS</th><th>INCONSISTENTES</th><th>Ações</th>
            </tr>
          </thead>
          <tbody><tr><td colspan="10" class="text-muted">Carregando...</td></tbody>
          </table>
        </div>
        </div>
      `).join("");
      
      const modal = FLUIGC.modal({
        title: `Resultado das Regras para ${nomePaciente || ""}`,
        content: `<div id="conteudo-exec-regras" style="max-height:70vh; overflow:auto; padding-right:6px;">${sectionsHtml}</div>`,
        id: "resultadoRegrasModal",
        size: "full",
        actions: [{ label: "Fechar", bind: "data-close", classType: "btn-secondary" }]
      });
      document.querySelector("[data-close]")?.addEventListener("click", () => modal.remove());
      
      // DataTable helper
      const initDT = (idRegra, dataRows) => {
        const sel = `#tbl-regra-${idRegra}`;
        if ($.fn.DataTable.isDataTable(sel)) $(sel).DataTable().destroy();
        const dt = $(sel).DataTable({
        data: dataRows, deferRender: true, pageLength: 20, lengthMenu: [20, 25, 50, 100],
        order: [], language: { decimal:",", thousands:".", lengthMenu:"Exibir _MENU_ registros",
          zeroRecords:"Nenhum registro", info:"Exibindo _START_ a _END_ de _TOTAL_",
          infoEmpty:"Exibindo 0 a 0 de 0", infoFiltered:"(filtrado de _MAX_ no total)",
          paginate:{ first:"Primeiro", last:"Último", next:"Próximo", previous:"Anterior" } },
        dom: "<'row'<'col-sm-12'>>tr<'row'<'col-sm-12 col-md-5'i><'col-sm-12 col-md-7'p>>",
        columns: [
          null, null, null, null, null, null,
          { className: 'text-right' }, // TOTAL
          { className: 'text-right' }, // DESCARTADOS
          { className: 'text-right' }, // INCONSISTENTES
          { orderable: false, searchable: false, className: 'text-center' }
        ]
        });
      
        // olho → detalhes
        $(`#tbl-regra-${idRegra}`).on('click', 'a.detalhe-prescricao', (e) => {
        e.preventDefault();
        const el = e.currentTarget;
        this.abrirDetalhe({
          idRegra,
          codcoligada: el.dataset.codcoligada,
          codpaciente: el.dataset.codpaciente,
          codatendimento: el.dataset.codatendimento,
          seqparcial: el.dataset.seqparcial
        });
        });
      };
      
      // monta cada bloco (regra)
      const montarPara = (regra) => {
        console.group(`[ExecutarRegrasPaciente] Regra ${regra.idRegra}`);
        try {
          const idNum = parseInt(regra.idRegra, 10);
          const filtroId = Number.isFinite(idNum)
            ? `IDREGRA = ${idNum}`
            : `IDREGRA = '${escSql(regra.idRegra || '')}'`;

          const filtros = [
            this.FILTRO_PADRAO,
            filtroId
          ];

          const addFiltro = (expr) => { if (expr) filtros.push(expr); };
          if (hasVal(codcoligada)) addFiltro(`JSON_VALUE(RESULTADO, '$.ocorrencia.COLIGADA') = '${escSql(codcoligada)}'`);
          if (hasVal(codPaciente)) addFiltro(`JSON_VALUE(RESULTADO, '$.ocorrencia.CODPACIENTE') = '${escSql(codPaciente)}'`);
          if (hasVal(codatendimento)) addFiltro(`JSON_VALUE(RESULTADO, '$.ocorrencia.CODATENDIMENTO') = '${escSql(codatendimento)}'`);
          if (hasVal(seqparcial)) addFiltro(`JSON_VALUE(RESULTADO, '$.ocorrencia.PARCIAL') = '${escSql(seqparcial)}'`);


          console.log(`[ExecutarRegrasPaciente] SQL executada:\n`, sql);
          const rows = this.queryRMConfig(sql) || [];
          console.log(`[ExecutarRegrasPaciente] Registros retornados:`, rows.length);

          const dataRows = rows.map(row => {
            const C = toInt(row.COLIGADA);
            const P = toInt(row.CODPACIENTE);
            const A = toInt(row.CODATENDIMENTO);
            const S = toInt(row.PARCIAL);
            const total = parseInt(row.TOTAL || 0, 10);
            const descartados = parseInt(row.TOTAL_DESCARTADOS || 0, 10);
            const inconsistentes = parseInt(row.TOTAL_INCONSISTENTES || 0, 10);
            const resolvidos = parseInt(row.TOTAL_RESOLVIDOS || 0, 10);
            const finalizada = (descartados + inconsistentes + resolvidos) === total && total > 0;
            const nomeComIcone = finalizada
              ? `${row.NOMEPACIENTE || ""} <span class="conta-finalizada" title="Conta Finalizada">✅</span>`
              : row.NOMEPACIENTE || "";

            return [
              C ?? "",
              row.PRONTUARIO || "",
              P ?? "",
              A ?? "",
              S ?? "",
              nomeComIcone,
              total,
              descartados,
              inconsistentes,
              `<a href="#" class="detalhe-prescricao"
               data-codcoligada="${C ?? ''}" data-codpaciente="${P ?? ''}"
               data-codatendimento="${A ?? ''}" data-seqparcial="${S ?? ''}"
               data-idregra="${regra.idRegra || ''}"
               title="Ver Detalhes"><i class="fluigicon fluigicon-eye-open icon-md"></i></a>`
            ];
          });

          const tbody = document.querySelector(`#tbl-regra-${regra.idRegra} tbody`);
          if (tbody) tbody.innerHTML = "";
          initDT(regra.idRegra, dataRows);
        } catch (err) {
          console.error(`[ExecutarRegrasPaciente] Erro ao montar dados da regra ${regra.idRegra}:`, err);
          const tbody = document.querySelector(`#tbl-regra-${regra.idRegra} tbody`);
          if (tbody) tbody.innerHTML = '<tr><td colspan="10" class="text-danger">Erro ao carregar dados.</td></tr>';
        } finally {
          console.groupEnd();
        }
      };
      
      // executa em sequência para não travar a UI
      const runSeq = (i = 0) => {
        if (i >= regrasSelecionadas.length) { this.esconderLoading(); return; }
        setTimeout(() => { montarPara(regrasSelecionadas[i]); runSeq(i + 1); }, 0);
      };
      runSeq();
    },
    // DataTable da lista (PT-BR e sem a caixa "Search")
    // Chips na célula + botão "Editar"
    renderEmailCell: function(emailStr){
      const arr = String(emailStr||'').split(';').map(s=>s.trim()).filter(Boolean);
      const chips = arr.length ? arr.map(e=>`<span class="chip">${e}</span>`).join('')
                  : `<span class="text-muted">Nenhum e-mail</span>`;
      // ícone + rótulo para ficar claro
      return `${chips}
      <button type="button" class="btn btn-default btn-xs btnEditEmail" title="E-mails">
        <span class="fluigicon fluigicon-edit icon-sm"></span> <span>Editar</span>
      </button>`;
    },
    // Editor de ticket médio
    abrirEditorTicketMedio: function(idRegra, ticketMedioAtual) {
      const modal = FLUIGC.modal({
      title: 'Editar Ticket Médio',
      id: 'modalTicketMedio',
      size: 'medium',
      content: `
        <div class="form-group">
        <label for="ticketMedioInput">Ticket Médio (R$):</label>
        <input type="number" 
             id="ticketMedioInput" 
             class="form-control" 
             value="${ticketMedioAtual}" 
             step="0.01" 
             min="0" 
             placeholder="0.00">
        <small class="text-muted">Digite o valor do ticket médio para esta regra</small>
        </div>
      `,
      actions: [
        { label: 'Salvar', bind: 'data-save', classType: 'btn-primary' }
      ]
      });
      
      // Event listeners
      const input = document.getElementById('ticketMedioInput');
      const btnSalvar = document.querySelector('[data-save]');
      
      btnSalvar.addEventListener('click', () => {
      const novoValor = parseFloat(input.value || 0);
      if (novoValor < 0) {
        FLUIGC.toast({ message: 'O valor deve ser maior ou igual a zero.', type: 'warning' });
        return;
      }
      
      this.salvarTicketMedio(idRegra, novoValor, modal);
      });
      
      // Focar no input
      setTimeout(() => input.focus(), 100);
    },
    
    // Salvar ticket médio
    salvarTicketMedio: function(idRegra, novoValor, modal) {
      this.mostrarLoading();
      const cleanupBackdrops = () => {
        try {
          document.querySelectorAll('.modal-backdrop').forEach(el => el.remove());
          document.body.classList.remove('modal-open');
          document.body.style.paddingRight = "";
          document.body.style.overflow = "";
        } catch(_){}
      };
      const rememberTab = () => {
        let tabToRestore = '#tab-config';
        try {
          const activeA = document.querySelector('.nav-tabs li.active a, .nav.nav-tabs .active a');
          const href = activeA && (activeA.getAttribute('href') || activeA.dataset.target);
          if (href) tabToRestore = href;
        } catch(_) {}
        sessionStorage.setItem('audit_active_tab', tabToRestore);
      };
      try {
        const sql = `UPDATE ZMD_BC_REGRAS SET TICKETMEDIO = ${novoValor} WHERE IDREGRAS = ${idRegra}`;
        console.log('[Ticket Médio] Executando SQL:', sql);
        
        const resultado = this.execRmDml(sql);
        
        if (resultado.error) {
          console.error('[Ticket Médio] Erro ao atualizar:', resultado.error);
          FLUIGC.toast({ message: 'Erro ao atualizar ticket médio. Veja o console.', type: 'danger' });
        } else {
          console.log('[Ticket Médio] Atualizado com sucesso:', resultado);
          FLUIGC.toast({ message: 'Ticket médio atualizado com sucesso!', type: 'success' });
          
        // Fechar modal e recarregar a tabela
        modal.remove();
        rememberTab();
        setTimeout(() => {
          try { modal.remove(); } catch(_) {}
          cleanupBackdrops();
          window.location.reload();
        }, 80);
        }
      } catch (e) {
        console.error('[Ticket Médio] Erro:', e);
        FLUIGC.toast({ message: 'Erro ao atualizar ticket médio. Veja o console.', type: 'danger' });
      } finally {
        this.esconderLoading();
      }
    },
    // Editor de e-mails (corrigido: sem usar modal.on)
    abrirEditorEmails: function(idRegra, emailStr, onSaved){
      const lista = String(emailStr||'').split(';').map(s=>s.trim()).filter(Boolean);
      
      const modal = FLUIGC.modal({
      title: `E-mails`,
      id: 'modalEmails',
      size: 'large',
      content: `
      <style>
        .chip{display:inline-flex;align-items:center;background:#eef1f7;border-radius:16px;padding:4px 8px;margin:4px}
        .chiplist{min-height:44px;border:1px solid #ddd;border-radius:4px;padding:6px}
      </style>
      <div class="form-group">
        <label>Lista de e-mails</label>
        <div class="chiplist" id="chipsEmails"></div>
      </div>
      `
      });
      
      const draw = ()=> {
      const box = document.getElementById('chipsEmails');
      if (!box) return;
      box.innerHTML = '';
      lista.forEach((em)=> {
        const chip = document.createElement('span');
        chip.className = 'chip';
        chip.textContent = em;
        box.appendChild(chip);
      });
      };
      
      const add = ()=> {
      const inp = document.getElementById('novoEmail');
      const v = (inp && inp.value || '').trim();
      if (!v) return;
      if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)){
        FLUIGC.toast({message:'E-mail inválido.', type:'warning'}); return;
      }
      if(!lista.includes(v)) lista.push(v);
      inp.value=''; draw();
      };
      
      setTimeout(()=> {
      draw();
      document.getElementById('btnAddEmail')?.addEventListener('click', add);
      document.getElementById('novoEmail')?.addEventListener('keypress', e=> {
        if(e.which===13||e.key==='Enter'){ e.preventDefault(); add(); }
      });
      document.querySelector('#modalEmails [data-cancel]')?.addEventListener('click', ()=> modal.remove());
      
      // >>> salvamento com a MESMA lógica do update do hash
      document.querySelector('#modalEmails [data-save]')?.addEventListener('click', () => {
        if (!idRegra) {
        FLUIGC.toast({ message: 'IDREGRAS vazio nesta regra.', type: 'warning' });
        return;
        }
        try {
        const joined = lista.join('; ');
        const idNum  = parseInt(idRegra, 10);
        if (Number.isNaN(idNum)) {
          FLUIGC.toast({ message: 'IDREGRAS inválido.', type: 'warning' });
          return;
        }
      
        const sql = `
        UPDATE [ZMD_BC_REGRAS]
           SET [EMAIL] = '${escSql(joined)}'
         WHERE [IDREGRAS] = ${idNum}
        `;
        console.log("SQL para salvar e-mails (Regra ID: " + idNum + "):", sql);
      
        // exatamente como no update do hash:
        const ds = DatasetFactory.getDataset(MyWidget.DATASET_RM, [MyWidget.JDBC_RM, sql], null, null);
        console.log('Retorno dataset (save emails):', ds);
        FLUIGC.toast({ message: 'E-mails atualizados.', type: 'success' });
        modal.remove();
        } catch (e) {
        console.error("Erro ao atualizar e-mails:", e);
        FLUIGC.toast({ message: 'Falha ao salvar e-mails. Veja o console.', type: 'danger' });
        }
      });
      }, 20);
    },
    // ======== EXPORT HELPERS (PDF/XLSX) =========
    exportGrid: function ({ tableSelector, filenameBase, title }) {
        const table = document.querySelector(tableSelector);
        if (!table) {
          FLUIGC.toast({ message: 'Tabela não encontrada.', type: 'warning' });
          return;
        }
      
        // verifica se há dados reais para exportar
        const hasData = () => {
          const thead = table.tHead && table.tHead.rows.length ? table.tHead.rows[0] : null;
          const headerCols = thead ? thead.cells.length : 0;
          const tbody = table.tBodies && table.tBodies.length ? table.tBodies[0] : null;
          if (!tbody || !tbody.rows.length) return false;
      
          let dataRows = 0;
          Array.from(tbody.rows).forEach(tr => {
            const cells = tr.cells || [];
            if (!cells.length) return;
      
            // linha placeholder: 1 célula com colspan == total de colunas do header
            const isPlaceholder =
              cells.length === 1 &&
              cells[0].hasAttribute('colspan') &&
              parseInt(cells[0].getAttribute('colspan'), 10) === headerCols;
      
            if (!isPlaceholder) dataRows++;
          });
          return dataRows > 0;
        };
      
        const safe = (s) => String(s || 'export').replace(/[^\w\-]+/g, '_');
        const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
        const fnamePdf  = safe(filenameBase) + '_' + ts + '.pdf';
        const fnameXlsx = safe(filenameBase) + '_' + ts + '.xlsx';
      
        const exportPdf = () => {
          if (!hasData()) {
            FLUIGC.toast({ message: 'Não há dados para exportar.', type: 'warning' });
            return;
          }
          try {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF('l', 'pt', 'a4'); // paisagem para tabelas largas
            if (title) doc.text(String(title), 40, 30);
            doc.autoTable({ html: table, startY: title ? 40 : 20, styles: { fontSize: 8 } });
            doc.save(fnamePdf);
          } catch (e) {
            console.error(e);
            FLUIGC.toast({ message: 'Falha ao exportar PDF.', type: 'danger' });
          }
        };
      
        const exportXlsx = () => {
          if (!hasData()) {
            FLUIGC.toast({ message: 'Não há dados para exportar.', type: 'warning' });
            return;
          }
          try {
            const wb = XLSX.utils.table_to_book(table, { sheet: 'Dados' });
            XLSX.writeFile(wb, fnameXlsx);
          } catch (e) {
            console.error(e);
            FLUIGC.toast({ message: 'Falha ao exportar XLSX.', type: 'danger' });
          }
        };
      
        return { exportPdf, exportXlsx };
    },
    // ========= helper para SQL (log + retorno seguro) =========
queryRMConfig: function(sql){
  try{
    console.log("[queryRMConfig] Executando SQL:", sql);
    console.log("[queryRMConfig] DATASET_RM:", this.DATASET_RM);
    console.log("[queryRMConfig] JDBC_RM:", this.JDBC_RM);
    
    var ds = DatasetFactory.getDataset(this.DATASET_RM, [this.JDBC_RM, sql], null, null);
    console.log("[queryRMConfig] Dataset retornado:", ds);
    console.log("[queryRMConfig] Dataset tem values?", ds && ds.values);
    console.log("[queryRMConfig] Quantidade de values:", ds && ds.values ? ds.values.length : 0);
    
    const result = (ds && ds.values) ? ds.values : [];
    console.log("[queryRMConfig] Valores extraídos:", result);
    console.log("[queryRMConfig] Tipo do resultado:", typeof result);
    console.log("[queryRMConfig] É array?", Array.isArray(result));
    
    return result;
  }catch(e){
    console.error("[queryRMConfig][ERRO]:", e);
    console.error("[queryRMConfig] Stack trace:", e.stack);
    return [];
  }
},
// ========= Função para recarregar dados do modal principal =========
recarregarDadosModal: function(idRegra, dt, masterRows, getFilteredRows) {
  
  try {
    // Executar a mesma consulta SQL para obter dados atualizados
    const sql = `
    SELECT 
        IDREGRA,
        JSON_VALUE(RESULTADO, '$.ocorrencia.COLIGADA')       AS COLIGADA,
        JSON_VALUE(RESULTADO, '$.ocorrencia.PRONTUARIO')     AS PRONTUARIO,
        JSON_VALUE(RESULTADO, '$.ocorrencia.CODPACIENTE')    AS CODPACIENTE,
        JSON_VALUE(RESULTADO, '$.ocorrencia.CODATENDIMENTO') AS CODATENDIMENTO,
        JSON_VALUE(RESULTADO, '$.ocorrencia.PARCIAL')        AS PARCIAL,
        JSON_VALUE(RESULTADO, '$.ocorrencia.NOMEPACIENTE')   AS NOMEPACIENTE,
        COUNT(*) AS TOTAL,
        SUM(CASE WHEN STATUS = 'D' THEN 1 ELSE 0 END) AS TOTAL_DESCARTADOS,
        SUM(CASE WHEN STATUS = 'I' THEN 1 ELSE 0 END) AS TOTAL_INCONSISTENTES,
        SUM(CASE WHEN STATUS = 'R' THEN 1 ELSE 0 END) AS TOTAL_RESOLVIDOS
    FROM ZMD_BC_RESULTADO
    WHERE ${this.FILTRO_PADRAO}
        AND IDREGRA = ${idRegra}
    GROUP BY 
        IDREGRA,
        JSON_VALUE(RESULTADO, '$.ocorrencia.COLIGADA'),
        JSON_VALUE(RESULTADO, '$.ocorrencia.PRONTUARIO'),
        JSON_VALUE(RESULTADO, '$.ocorrencia.CODPACIENTE'),
        JSON_VALUE(RESULTADO, '$.ocorrencia.CODATENDIMENTO'),
        JSON_VALUE(RESULTADO, '$.ocorrencia.PARCIAL'),
        JSON_VALUE(RESULTADO, '$.ocorrencia.NOMEPACIENTE')
    ORDER BY JSON_VALUE(RESULTADO, '$.ocorrencia.NOMEPACIENTE');`;
    
    console.log("Executando consulta SQL para atualização:", sql);
    const rows = this.queryRMConfig(sql);
    console.log("Dados atualizados recebidos:", rows);
    
    if (!rows.length) {
      console.warn("Nenhum resultado encontrado para atualização");
      // Em vez de retornar, vamos continuar e limpar o modal
      // return;
    }
    
            // Atualizar masterRows com os novos dados
        masterRows.length = 0; // Limpar array
        rows.forEach(r => {
          const C = r.COLIGADA, P = r.CODPACIENTE, A = r.CODATENDIMENTO, S = r.PARCIAL;
          const total = parseInt(r.TOTAL || 0, 10);
          const descartados = parseInt(r.TOTAL_DESCARTADOS || 0, 10);
          const inconsistentes = parseInt(r.TOTAL_INCONSISTENTES || 0, 10);
          const resolvidos = parseInt(r.TOTAL_RESOLVIDOS || 0, 10);
          const finalizada = (descartados + inconsistentes + resolvidos) === total && total > 0;
          
          // Adicionar ícone de finalizada na coluna NOME se estiver finalizada
          const nomeComIcone = finalizada 
            ? `${r.NOMEPACIENTE || ""} <span class="conta-finalizada" title="Conta Finalizada">✅</span>`
            : r.NOMEPACIENTE || "";
          
          
          masterRows.push([
            C || "", r.PRONTUARIO || "", P || "", A || "", S || "", nomeComIcone,
            total, descartados, inconsistentes, resolvidos,
            `<a href="#" class="detalhe-prescricao"
            data-codcoligada="${C || ''}" data-codpaciente="${P || ''}"
            data-codatendimento="${A || ''}" data-seqparcial="${S || ''}"
            data-idregra="${r.IDREGRA || ''}"
            title="Ver Detalhes"><i class="fluigicon fluigicon-eye-open icon-md"></i></a>`
          ]);
        });
    
        
        const q = ($('#queryResultsModal .dataTables_filter input').val() || "");
        dt.clear().rows.add(getFilteredRows()).draw(false);
        $('#queryResultsModal .dataTables_filter input').val(q);
        dt.search(q).draw(false);
    
  } catch (error) {
    console.error("Erro ao recarregar dados do modal:", error);
    FLUIGC.toast({ message: "Erro ao atualizar dados. Veja o console.", type: "danger" });
  }
},
// ========= carregar a aba de Configurações (emails + classificações) =========
carregarAbaConfiguracoes: function(){
  console.group("[Config] carregarAbaConfiguracoes()");
  this.mostrarLoading();
  try {
    //ISNULL(TICKETMEDIO, 0)
    // 1) SELECTs
    const regras = this.queryRMConfig(`
      SELECT IDREGRAS, TITULOREGRA AS DESCRICAOREGRA, ATIVO, ISNULL(TICKETMEDIO, 0) AS TICKETMEDIO
      FROM ZMD_BC_REGRAS
       WHERE ATIVO = 1
       ORDER BY DESCRICAOREGRA;`);

    const relEmails = this.queryRMConfig(`
      SELECT re.IDREGRAS, e.IDEMAIL, e.EMAIL
        FROM ZMD_BC_RELEMAILSREGRAS re
        JOIN ZMD_BC_EMAILSREGRAS e ON e.IDEMAIL = re.IDEMAIL;`);

    const relClass = this.queryRMConfig(`
      SELECT rc.IDREGRAS, c.IDCLASSIFICACAO, c.DESCRICAO
        FROM ZMD_BC_RELCLASSIFICACAOREGRA rc
        JOIN ZMD_BC_CLASSIFICACAOREGRAS c ON c.IDCLASSIFICACAO = rc.IDCLASSIFICACAO;`);

    // 2) Select2 - usando as funções de refresh
    this.refreshEmailsDisponiveisSelect();
    this.refreshClassificacoesDisponiveisSelect();

    // 2.1) CSS (hover/cursor dos chips)
    this.injectConfigCss();

    // 3) Mapas
    const mapEmails = {};
    (relEmails || []).forEach(r => {
      (mapEmails[r.IDREGRAS] = mapEmails[r.IDREGRAS] || []).push({ id:r.IDEMAIL, email:r.EMAIL });
    });
    const mapClass = {};
    (relClass || []).forEach(r => {
      (mapClass[r.IDREGRAS] = mapClass[r.IDREGRAS] || []).push({ id:r.IDCLASSIFICACAO, nome:r.DESCRICAO });
    });

    // 4) Render linhas
    const tbody = document.querySelector("#configRulesTable tbody");
    if (tbody) tbody.innerHTML = "";

    (regras || []).forEach(r => {
      const listEmails = mapEmails[r.IDREGRAS] || [];
      const listClass  = mapClass[r.IDREGRAS]  || [];

      const tooltipEmails = listEmails.length
        ? listEmails.map(e => escHtml(e.email)).join("<br>")
        : "Nenhum e-mail";

      const tdClass = listClass.length
        ? listClass.map(c => `
            <span class="chip" data-idregra="${r.IDREGRAS}" data-idclass="${c.id}">
              ${escHtml(c.nome)}
              <i class="fluigicon fluigicon-remove icon-sm unlink-class" title="Desvincular"></i>
            </span>`).join(" ")
        : `<span class="text-muted">—</span>`;

      const tr = document.createElement("tr");
      const ticketMedio = parseFloat(r.TICKETMEDIO || 0).toFixed(2);
      
      // Debug: verificar se os dados estão chegando
      console.log(`[Ticket Médio] Regra ${r.IDREGRAS}: TICKETMEDIO = ${r.TICKETMEDIO}, parseado = ${ticketMedio}`);
      
      tr.innerHTML = `
        <td style="text-align:center; width:28px;">
          <input type="checkbox" class="ruleCheckbox" data-idregra="${r.IDREGRAS}">
        </td>
        <td style="text-align:center; width:60px;">${r.IDREGRAS || ""}</td>
        <td>${escHtml(r.DESCRICAOREGRA || "")}</td>
        <td class="text-center" style="width:70px;">
          <button class="btn btn-link btn-xs open-emails" data-idregra="${r.IDREGRAS}" data-toggle="tooltip" data-html="true"
          title="${tooltipEmails.replace(/"/g,'&quot;')}" style="padding:0;">
        <i class="fluigicon fluigicon-envelope icon-md" aria-hidden="true"></i>
          </button>
        </td>
        <td class="class-cell">${tdClass}</td>
        <td style="text-align:center;">
          <span class="ticket-medio-value">R$ ${ticketMedio}</span>
          <button class="btn btn-default btn-xs btnEditTicket" 
        data-idregra="${r.IDREGRAS}"
        data-ticketmedio="${r.TICKETMEDIO || 0}"
        title="Editar Ticket Médio"
        style="border: 1px solid #ccc; background: #f8f9fa; margin-left: 5px; padding: 2px 4px; cursor: pointer;">
          <i class="flaticon flaticon-edit icon-sm" aria-hidden="true"></i>
          </button>
        </td>`;
      tbody.appendChild(tr);
    });

    // 5) Delegações
    $("#configRulesTable")
      .off("click", ".open-emails")
      .on("click", ".open-emails", (ev) => {
        const idRegra = parseInt(ev.currentTarget.getAttribute("data-idregra"), 10);
        this.abrirModalEmailsRegra(idRegra);
      });

    $("#configRulesTable")
      .off("click", ".unlink-class")
      .on("click", ".unlink-class", (ev) => {
        const chip = ev.currentTarget.closest(".chip");
        const idRegra = chip.getAttribute("data-idregra");
        const idClass = chip.getAttribute("data-idclass");
        this.desvincularClassificacaoDeRegra(idRegra, idClass);
      });
      
    // Event listener para editar ticket médio
    $("#configRulesTable")
      .off("click", ".btnEditTicket")
      .on("click", ".btnEditTicket", (ev) => {
        const btn = ev.currentTarget;
        const idRegra = btn.getAttribute("data-idregra");
        const ticketMedio = parseFloat(btn.getAttribute("data-ticketmedio") || 0);
        this.abrirEditorTicketMedio(idRegra, ticketMedio);
      });

    // 6) DataTable + tooltips
    this.initConfigDataTable();
    
    // 7) Carregar regras em análise
    this.carregarRegrasAnalise();
  } finally {
    this.esconderLoading();
    console.groupEnd();
  }
},
abrirModalAdicionarEmail: function(){
  console.group("[Config] abrirModalAdicionarEmail()");
  const modal = FLUIGC.modal({
    title: "Adicionar E-mail",
    id: "modalAddEmailRM",
    size: "small",
    content: `
      <div class="form-group">
        <label>Novo e-mail</label>
        <input type="email" id="novoEmailRM" class="form-control" placeholder="nome@dominio.com">
      </div>`,
    actions: [
      { label: "Salvar", bind: "data-ok", classType: "btn-primary" },
      { label: "Cancelar", bind: "data-cancel", classType: "btn-secondary" }
    ]
  });

  $("#modalAddEmailRM [data-cancel]").on("click", () => modal.remove());
  $("#modalAddEmailRM [data-ok]").on("click", () => {
    const val = (document.getElementById('novoEmailRM').value || '').trim();
    const isMail = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(val);
    if (!isMail){ FLUIGC.toast({ message:"E-mail inválido.", type:"warning" }); return; }

    try{
      const res = this.execRmDml(`
IF NOT EXISTS (SELECT 1 FROM ZMD_BC_EMAILSREGRAS WHERE EMAIL='${escSql(val)}')
  INSERT INTO ZMD_BC_EMAILSREGRAS (EMAIL) VALUES ('${escSql(val)}')`);
      if (res.error){
        FLUIGC.toast({ message:"Falha ao inserir e-mail. Veja o console.", type:"danger" });
        console.warn(res); return;
      }
      const rows = this.queryRMConfig(`SELECT TOP 1 IDEMAIL, EMAIL FROM ZMD_BC_EMAILSREGRAS WHERE EMAIL='${escSql(val)}' ORDER BY IDEMAIL DESC;`);
      const novo = rows && rows[0];
      FLUIGC.toast({ message:"E-mail cadastrado com sucesso.", type:"success" });
      this.refreshEmailsDisponiveisSelect(novo && novo.IDEMAIL);
      modal.remove();
    }catch(e){
      console.error(e);
      FLUIGC.toast({ message:"Erro ao cadastrar e-mail. Veja o console.", type:"danger" });
    }
  });
  console.groupEnd();
},
refreshEmailsDisponiveisSelect: function(preselectId){
  console.group("[Config] refreshEmailsDisponiveisSelect()", { preselectId });
  try{
    let emailsDisp = this.queryRMConfig(`SELECT IDEMAIL, EMAIL FROM ZMD_BC_EMAILSREGRAS ORDER BY EMAIL;`);
    if (!emailsDisp || !emailsDisp.length){
      emailsDisp = this.queryRMConfig(`
        SELECT DISTINCT e.IDEMAIL, e.EMAIL
          FROM ZMD_BC_RELEMAILSREGRAS re
          JOIN ZMD_BC_EMAILSREGRAS e ON e.IDEMAIL = re.IDEMAIL
         ORDER BY e.EMAIL;`);
    }
    const $selEmails = $("#selectEmailsVinculo");
    const current    = ($selEmails.val() || []).slice();

    $selEmails.empty();
    (emailsDisp || []).forEach(e => $selEmails.append(new Option(e.EMAIL, e.IDEMAIL)));

    if ($selEmails.data('select2')) $selEmails.select2('destroy');
    $selEmails.select2({ width:"100%", placeholder:"Selecione e-mails", allowClear:true });

    if (preselectId){
      const arr = new Set(current.concat(String(preselectId)));
      $selEmails.val(Array.from(arr)).trigger('change');
    } else if (current.length){
      $selEmails.val(current).trigger('change');
    }
  }catch(e){
    console.error(e);
  }finally{
    console.groupEnd();
  }
},
abrirModalAdicionarClassificacao: function(){
  console.group("[Config] abrirModalAdicionarClassificacao()");
  const modal = FLUIGC.modal({
    title: "Adicionar Classificação",
    id: "modalAddClassificacaoRM",
    size: "small",
    content: `
      <div class="form-group">
        <label>Nova classificação</label>
        <input type="text" id="novaClassificacaoRM" class="form-control" placeholder="Digite o nome da classificação">
      </div>`,
    actions: [
      { label: "Salvar", bind: "data-ok", classType: "btn-primary" },
      { label: "Cancelar", bind: "data-cancel", classType: "btn-secondary" }
    ]
  });

  const rememberTab = () => {
    let tabToRestore = '#tab-config';
    try {
      const activeA = document.querySelector('.nav-tabs li.active a, .nav.nav-tabs .active a');
      const href = activeA && (activeA.getAttribute('href') || activeA.dataset.target);
      if (href) tabToRestore = href;
    } catch(_) {}
    sessionStorage.setItem('audit_active_tab', tabToRestore);
  };

  const cleanupBackdrops = () => {
    try {
      document.querySelectorAll('.modal-backdrop').forEach(el => el.remove());
      document.body.classList.remove('modal-open');
      document.body.style.paddingRight = "";
      document.body.style.overflow = "";
    } catch(_){}
  };

  $("#modalAddClassificacaoRM [data-cancel]").on("click", () => modal.remove());
  $("#modalAddClassificacaoRM [data-ok]").on("click", () => {
    const val = (document.getElementById('novaClassificacaoRM').value || '').trim();
    if (!val){ FLUIGC.toast({ message:"Nome da classificação é obrigatório.", type:"warning" }); return; }

    try{
      const res = this.execRmDml(`
IF NOT EXISTS (SELECT 1 FROM ZMD_BC_CLASSIFICACAOREGRAS WHERE DESCRICAO='${escSql(val)}')
  INSERT INTO ZMD_BC_CLASSIFICACAOREGRAS (DESCRICAO) VALUES ('${escSql(val)}')`);
      if (res.error){
        FLUIGC.toast({ message:"Falha ao inserir classificação. Veja o console.", type:"danger" });
        console.warn(res); return;
      }

      FLUIGC.toast({ message:"Classificação cadastrada com sucesso.", type:"success" });

      // lembrar aba e recarregar
      rememberTab();
      setTimeout(() => {
        try { modal.remove(); } catch(_) {}
        cleanupBackdrops();
        window.location.reload();
      }, 80);

    }catch(e){
      console.error(e);
      FLUIGC.toast({ message:"Erro ao cadastrar classificação. Veja o console.", type:"danger" });
    }
  });
  console.groupEnd();
},

refreshClassificacoesDisponiveisSelect: function(preselectId){
  console.group("[Config] refreshClassificacoesDisponiveisSelect()", { preselectId });
  try{
    let classDisp = this.queryRMConfig(`SELECT IDCLASSIFICACAO, DESCRICAO FROM ZMD_BC_CLASSIFICACAOREGRAS ORDER BY DESCRICAO;`);
    if (!classDisp || !classDisp.length){
      classDisp = this.queryRMConfig(`
        SELECT DISTINCT c.IDCLASSIFICACAO, c.DESCRICAO
          FROM ZMD_BC_RELCLASSIFICACAOREGRA rc
          JOIN ZMD_BC_CLASSIFICACAOREGRAS c ON c.IDCLASSIFICACAO = rc.IDCLASSIFICACAO
         ORDER BY c.DESCRICAO;`);
    }
    const $selClass = $("#selectClassificacoesVinculo");
    const current    = ($selClass.val() || []).slice();

    $selClass.empty();
    (classDisp || []).forEach(c => $selClass.append(new Option(c.DESCRICAO, c.IDCLASSIFICACAO)));

    if ($selClass.data('select2')) $selClass.select2('destroy');
    $selClass.select2({ width:"100%", placeholder:"Selecione classificações", allowClear:true });

    if (preselectId){
      const arr = new Set(current.concat(String(preselectId)));
      $selClass.val(Array.from(arr)).trigger('change');
    } else if (current.length){
      $selClass.val(current).trigger('change');
    }
  }catch(e){
    console.error(e);
  }finally{
    console.groupEnd();
  }
},
// ========= marcar/desmarcar todos (apenas a tabela da aba Config) =========
selecionarTodosConfig: function(master){
  const root = document.querySelector("#configRulesTable");
  if (!root) return;
  root.querySelectorAll(".ruleCheckbox").forEach(cb => cb.checked = master.checked);
},
// ========= REGRAS EM ANÁLISE =========
carregarRegrasAnalise: function(){
  console.group("[Config] carregarRegrasAnalise()");
  this.mostrarLoading();
  try {
    // Buscar regras com STATUS = 2 (pendentes) e STATUS = 3 (recusadas)
    const sqlRegrasAnalise = `
    SELECT IDREGRAS, TITULOREGRA AS DESCRICAOREGRA, ATIVO, RECCREATEDON AS DATACRIACAO, RECCREATEDBY AS USUARIOCRIACAO
      FROM ZMD_BC_REGRAS
      WHERE ATIVO IN (2, 3)
    ORDER BY RECCREATEDON;`;
    console.log("Executando consulta SQL para regras em análise:", sqlRegrasAnalise);
    const regrasAnalise = this.queryRMConfig(sqlRegrasAnalise);
    console.log("Regras em análise recebidas:", regrasAnalise);

    // Renderizar tabela
    const tbody = document.querySelector("#configRulesAnaliseTable tbody");
    if (tbody) tbody.innerHTML = "";

    (regrasAnalise || []).forEach(r => {
      const statusText = r.ATIVO === '2' ? "Pendente" : "Recusada";
      const statusClass = r.ATIVO === '2' ? "label-warning" : "label-danger";
      const dataCriacao = r.DATACRIACAO ? new Date(r.DATACRIACAO).toLocaleDateString("pt-BR") : "-";

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td style="text-align:center; width:28px;">
          <input type="checkbox" class="ruleCheckboxAnalise" data-idregra="${r.IDREGRAS}" data-status="${r.ATIVO}">
        </td>
        <td>${escHtml(r.DESCRICAOREGRA || "")}</td>
        <td style="text-align:center;">
          <span class="label ${statusClass}">${statusText}</span>
        </td>
        <td style="text-align:center;">${dataCriacao}</td>
        <td>${escHtml(r.USUARIOCRIACAO || "")}</td>
      `;
      tbody.appendChild(tr);
    });

    // Ajustar altura da tabela para ocupar o espaço da tela
    const tableWrapper = document.querySelector("#configRulesAnaliseTable_wrapper");
    if (tableWrapper) {
      tableWrapper.style.minHeight = "calc(100vh - 400px)"; // Ajuste para ocupar o espaço da tela
      tableWrapper.style.display = "flex";
      tableWrapper.style.flexDirection = "column";
    }
    
    // Ajustar altura do tbody para ocupar o espaço restante
    const tbodyElement = document.querySelector("#configRulesAnaliseTable tbody");
    if (tbodyElement) {
      tbodyElement.style.minHeight = "calc(100vh - 500px)";
    }
    
    // Garantir que a tabela ocupe toda a largura mesmo sem dados
    setTimeout(() => {
      const $table = $('#configRulesAnaliseTable');
      const $wrapper = $('#configRulesAnaliseTable_wrapper');
      
      // Forçar redimensionamento da tabela
      $table.css({ 
        width: '100%', 
        tableLayout: 'fixed',
        minWidth: '100%'
      });
      
      $wrapper.css({ 
        width: '100%',
        minWidth: '100%'
      });
      
      // Ajustar larguras das colunas
      $table.find('th').each(function(index) {
        if (index === 0) $(this).css('width', '28px'); // Checkbox
        else if (index === 1) $(this).css('width', '40%'); // Título
        else if (index === 2) $(this).css('width', '15%'); // Status
        else if (index === 3) $(this).css('width', '15%'); // Data
        else if (index === 4) $(this).css('width', '30%'); // Usuário
      });
      
      // Redesenhar a DataTable para aplicar as mudanças
      if (this.dtAnalise) {
        this.dtAnalise.columns.adjust();
      }
    }, 100);

    // Inicializar DataTable
    this.initAnaliseDataTable();
    
    // Aplicar filtro inicial (pendentes)
    this.filtrarRegrasAnalise('pendente');

    // Ajustar tamanho do input de busca
    const $filterWrap = $('#configRulesAnaliseTable_wrapper .dataTables_filter');
    $filterWrap.find('input').addClass('form-control input-sm').css({ width: '260px', display: 'inline-block', marginLeft: '6px' });

  } catch (e) {
    console.error(e);
    FLUIGC.toast({ message: "Erro ao carregar regras em análise. Veja o console.", type: "danger" });
  } finally {
    this.esconderLoading();
    console.groupEnd();
  }
},
filtrarRegrasAnalise: function(tipo){
  console.group("[Config] filtrarRegrasAnalise()", { tipo });
  
  // Atualizar botões
  $("#btnAnalisePendente").removeClass("active btn-primary").addClass("btn-default");
  $("#btnAnaliseRecusada").removeClass("active btn-primary").addClass("btn-default");
  
  if (tipo === 'pendente') {
    $("#btnAnalisePendente").removeClass("btn-default").addClass("active btn-primary");
  } else if (tipo === 'recusada') {
    $("#btnAnaliseRecusada").removeClass("btn-default").addClass("active btn-primary");
  }

  // Aplicar filtro na DataTable
  if (this.dtAnalise) {
    // A coluna 2 exibe o texto "Pendente"/"Recusada", não os códigos 2/3.
    const statusText = (tipo === 'pendente') ? 'Pendente' : 'Recusada';
    this.dtAnalise.column(2).search(statusText).draw();
  }
  
  console.groupEnd();
},
initAnaliseDataTable: function(){
  if ($.fn.DataTable.isDataTable('#configRulesAnaliseTable')) {
    $('#configRulesAnaliseTable').DataTable().destroy();
  }

  this.dtAnalise = $('#configRulesAnaliseTable').DataTable({
    autoWidth: false,
    pageLength: 10,
    lengthMenu: [10, 25, 50],
    order: [[3, 'desc']], // Ordenar por data de criação (decrescente)
    columnDefs: [
      { targets: 0, orderable: false, searchable: false, width: 28 },
      { targets: 1, orderable: true, searchable: true, width: "40%" },
      { targets: 2, orderable: true, searchable: true, width: "15%" },
      { targets: 3, orderable: true, searchable: false, width: "15%" },
      { targets: 4, orderable: true, searchable: true, width: "30%" }
    ],
    language: {
      decimal: ",", thousands: ".",
      lengthMenu: "Exibir _MENU_ registros",
      zeroRecords: "Nenhuma regra em análise encontrada",
      info: "Exibindo _START_ a _END_ de _TOTAL_",
      infoEmpty: "Exibindo 0 a 0 de 0",
      infoFiltered: "(filtrado de _MAX_ no total)",
      paginate: { first: "Primeiro", last: "Último", next: "Próximo", previous: "Anterior" },
      processing: "Processando...",
      search: "Buscar:"
    },
    dom: "<'row'<'col-sm-12 col-md-6'l><'col-sm-12 col-md-6'f>>" +
         "tr<'row'<'col-sm-12 col-md-5'i><'col-sm-12 col-md-7'p>>"
  });

      // Aplicar estilos aos controles da DataTable
    const $lenWrap = $('#configRulesAnaliseTable_wrapper .dataTables_length');
    $lenWrap.find('select').addClass('form-control input-sm').css({ width: '120px', display: 'inline-block', margin: '0 6px' });
    $lenWrap.find('label').css({ whiteSpace: 'nowrap' });

    const $filterWrap = $('#configRulesAnaliseTable_wrapper .dataTables_filter');
    $filterWrap.find('input').addClass('form-control input-sm').attr('placeholder', 'Buscar em todas as colunas...').css({ width: '280px', display: 'inline-block', marginLeft: '6px' });
    
    // Forçar a tabela a ocupar toda a largura disponível
    const $table = $('#configRulesAnaliseTable');
    $table.css({ width: '100%', tableLayout: 'fixed' });
    
    // Ajustar o wrapper da DataTable para ocupar toda a largura
    const $wrapper = $('#configRulesAnaliseTable_wrapper');
    $wrapper.css({ width: '100%' });
    
    // Ajustar o container da tabela
    const $tableContainer = $wrapper.find('.dataTables_scrollBody');
    if ($tableContainer.length) {
      $tableContainer.css({ width: '100%' });
    }
  
    // Aplicar highlight de texto
  this.applyHighlightToAnaliseTable(this.dtAnalise);
},
selecionarTodosAnalise: function(master){
  const root = document.querySelector("#configRulesAnaliseTable");
  if (!root) return;
  root.querySelectorAll(".ruleCheckboxAnalise").forEach(cb => cb.checked = master.checked);
},
applyHighlightToConfigTable: function(dt){
  // ---- highlight acento/case-insensível ----
  const highlightInsensitive = (text, term) => {
    const src = String(text || "");
    const t = String(term || "").trim();
    if (!t) return src;

    const strip = s => String(s || "")
      .replace(/<[^>]*>/g, "")
      .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
      .toLowerCase();

    const srcChars = Array.from(src);
    let normStr = "", map = [];
    for (let i = 0; i < srcChars.length; i++) {
      const n = strip(srcChars[i]);
      for (let j = 0; j < n.length; j++) { normStr += n[j]; map.push(i); }
    }
    const termNorm = strip(t);
    if (!termNorm) return src;

    let out = "", normIdx = 0, lastOrig = 0;
    while (true) {
      const found = normStr.indexOf(termNorm, normIdx);
      if (found === -1) break;
      const oStart = map[found];
      const oEnd   = (map[found + termNorm.length - 1] ?? (srcChars.length - 1)) + 1;
      out += src.substring(lastOrig, oStart) + '<mark>' + src.substring(oStart, oEnd) + '</mark>';
      lastOrig = oEnd;
      normIdx = found + termNorm.length;
    }
    out += src.substring(lastOrig);
    return out;
  };

  // ---- Aplicar highlights nas células da tabela de configuração ----
  const applyHighlights = () => {
    const term = ($('#configRulesTable_wrapper .dataTables_filter input').val() || "").trim();
    if (!term) {
      // Remove highlights se não há termo de busca
      dt.rows({ page: 'current' }).every(function () {
        const $row = $(this.node());
        $row.find('td').each(function() {
          const $td = $(this);
          if ($td.find('mark').length) {
            $td.html($td.text()); // Remove tags mark mantendo o texto
          }
        });
      });
      return;
    }

    dt.rows({ page: 'current' }).every(function () {
      const $row = $(this.node());
      
      // Aplica highlight apenas na coluna do Título da Regra (coluna 1)
      const raw = this.data()[1]; // Título da Regra
      const td = $row.find('td').get(1);
      if (td) {
        td.innerHTML = highlightInsensitive(raw, term);
      }
      
      // Para emails e classificações, não aplicar highlight pois contêm HTML
      // As colunas 2 (Emails) e 3 (Classificação) são renderizadas com HTML
      // e não devem ser destacadas na busca
    });
  };

  // Aplica highlight quando a tabela é redesenhada
  dt.on('draw.dt', applyHighlights);
  $('#configRulesTable_wrapper .dataTables_filter input').off('input.hl').on('input.hl', () => { dt.draw(false); });
},
applyHighlightToAnaliseTable: function(dt){
  // ---- highlight acento/case-insensível ----
  const highlightInsensitive = (text, term) => {
    const src = String(text || "");
    const t = String(term || "").trim();
    if (!t) return src;

    const strip = s => String(s || "")
      .replace(/<[^>]*>/g, "")
      .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
      .toLowerCase();

    const srcChars = Array.from(src);
    let normStr = "", map = [];
    for (let i = 0; i < srcChars.length; i++) {
      const n = strip(srcChars[i]);
      for (let j = 0; j < n.length; j++) { normStr += n[j]; map.push(i); }
    }
    const termNorm = strip(t);
    if (!termNorm) return src;

    let out = "", normIdx = 0, lastOrig = 0;
    while (true) {
      const found = normStr.indexOf(termNorm, normIdx);
      if (found === -1) break;
      const oStart = map[found];
      const oEnd   = (map[found + termNorm.length - 1] ?? (srcChars.length - 1)) + 1;
      out += src.substring(lastOrig, oStart) + '<mark>' + src.substring(oStart, oEnd) + '</mark>';
      lastOrig = oEnd;
      normIdx = found + termNorm.length;
    }
    out += src.substring(lastOrig);
    return out;
  };

  // ---- Aplicar highlights nas células da tabela de análise ----
  const applyHighlights = () => {
    const term = ($('#configRulesAnaliseTable_wrapper .dataTables_filter input').val() || "").trim();
    if (!term) {
      // Remove highlights se não há termo de busca
      dt.rows({ page: 'current' }).every(function () {
        const $row = $(this.node());
        $row.find('td').each(function() {
          const $td = $(this);
          if ($td.find('mark').length) {
            $td.html($td.text()); // Remove tags mark mantendo o texto
          }
        });
      });
      return;
    }

    dt.rows({ page: 'current' }).every(function () {
      const $row = $(this.node());
      
      // Aplica highlight apenas nas colunas de texto puro
      // Coluna 1: Título da Regra
      const titulo = this.data()[1];
      const tdTitulo = $row.find('td').get(1);
      if (tdTitulo) {
        tdTitulo.innerHTML = highlightInsensitive(titulo, term);
      }
      
      // Coluna 4: Usuário
      const usuario = this.data()[4];
      const tdUsuario = $row.find('td').get(4);
      if (tdUsuario) {
        tdUsuario.innerHTML = highlightInsensitive(usuario, term);
      }
      
      // Não aplicar highlight nas colunas 2 (Status) e 3 (Data) pois contêm formatação
    });
  };

  // Aplica highlight quando a tabela é redesenhada
  dt.on('draw.dt', applyHighlights);
  $('#configRulesAnaliseTable_wrapper .dataTables_filter input').off('input.hl').on('input.hl', () => { dt.draw(false); });
},
// ========= Vincular e-mails às regras selecionadas =========
vincularEmailsAsRegrasSelecionadas: function(){
  console.group("[Config] vincularEmailsAsRegrasSelecionadas()");
  const idsRegras = this.getRegrasSelecionadas();
  const idsEmails = ($("#selectEmailsVinculo").val() || []).map(v => parseInt(v,10)).filter(n => !Number.isNaN(n));

  if (!idsRegras.length) { FLUIGC.toast({ message:"Selecione pelo menos uma regra.", type:"warning" }); console.groupEnd(); return; }
  if (!idsEmails.length) { FLUIGC.toast({ message:"Selecione pelo menos um e-mail.", type:"warning" }); console.groupEnd(); return; }

  const rememberTab = () => {
    let tabToRestore = '#tab-config';
    try {
      const activeA = document.querySelector('.nav-tabs li.active a, .nav.nav-tabs .active a');
      const href = activeA && (activeA.getAttribute('href') || activeA.dataset.target);
      if (href) tabToRestore = href;
    } catch(_) {}
    sessionStorage.setItem('audit_active_tab', tabToRestore);
  };

  this.mostrarLoading();
  try{
    let erros=0;
    idsRegras.forEach(idR => {
      idsEmails.forEach(idE => {
        const sql = `
IF NOT EXISTS (SELECT 1 FROM ZMD_BC_RELEMAILSREGRAS WHERE IDREGRAS=${idR} AND IDEMAIL=${idE})
  INSERT INTO ZMD_BC_RELEMAILSREGRAS (IDREGRAS, IDEMAIL) VALUES (${idR}, ${idE})`;
        console.log("[Config][VincularEmail][SQL]:\n" + sql);
        const res = this.execRmDml(sql);
        if (res.error) erros++;
      });
    });

    if (erros) {
      FLUIGC.toast({ message:"Alguns vínculos falharam. Veja o console.", type:"danger" });
      this.esconderLoading();
      console.groupEnd();
      return;
    }

    FLUIGC.toast({ message:`Vínculos aplicados.`, type:"success" });

    // lembrar aba e recarregar
    rememberTab();
    setTimeout(() => {
      try { this.esconderLoading(); } catch(_){}
      window.location.reload();
    }, 80);

  } catch(e){
    console.error(e);
    FLUIGC.toast({ message:"Erro ao vincular e-mails. Veja o console.", type:"danger" });
  } finally {
    console.groupEnd();
  }
},

// ========= Vincular classificações às regras selecionadas =========
vincularClassificacoesAsRegrasSelecionadas: function(){
  console.group("[Config] vincularClassificacoesAsRegrasSelecionadas()");
  const idsRegras = this.getRegrasSelecionadas();
  const idsClass  = ($("#selectClassificacoesVinculo").val() || []).map(v => parseInt(v,10)).filter(n => !Number.isNaN(n));

  if (!idsRegras.length) { FLUIGC.toast({ message:"Selecione pelo menos uma regra.", type:"warning" }); console.groupEnd(); return; }
  if (!idsClass.length)  { FLUIGC.toast({ message:"Selecione pelo menos uma classificação.", type:"warning" }); console.groupEnd(); return; }

  const rememberTab = () => {
    let tabToRestore = '#tab-config';
    try {
      const activeA = document.querySelector('.nav-tabs li.active a, .nav.nav-tabs .active a');
      const href = activeA && (activeA.getAttribute('href') || activeA.dataset.target);
      if (href) tabToRestore = href;
    } catch(_) {}
    sessionStorage.setItem('audit_active_tab', tabToRestore);
  };

  this.mostrarLoading();
  try{
    let total=0, erros=0;
    idsRegras.forEach(idR => {
      idsClass.forEach(idC => {
        const sql = `
IF NOT EXISTS (SELECT 1 FROM ZMD_BC_RELCLASSIFICACAOREGRA WHERE IDREGRAS=${idR} AND IDCLASSIFICACAO=${idC})
  INSERT INTO ZMD_BC_RELCLASSIFICACAOREGRA (IDREGRAS, IDCLASSIFICACAO) VALUES (${idR}, ${idC})`;
        console.log("[Config][VincularClass][SQL]:\n" + sql);
        const res = this.execRmDml(sql);
        total += (res.affected||0);
        if (res.error) erros++;
      });
    });
    if (erros) FLUIGC.toast({ message:"Alguns vínculos falharam. Veja o console.", type:"danger" });
    else       FLUIGC.toast({ message:`Vínculos aplicados.`, type:"success" });

    // lembrar aba e recarregar (mesmo comportamento do email)
    rememberTab();
    setTimeout(() => {
      try { this.esconderLoading(); } catch(_){}
      window.location.reload();
    }, 80);

  } catch(e){
    console.error(e);
    FLUIGC.toast({ message:"Erro ao vincular classificações. Veja o console.", type:"danger" });
  } finally {
    console.groupEnd();
  }
},

getRegrasSelecionadas: function(){
  const out = [];
  document.querySelectorAll('#configRulesTable .ruleCheckbox:checked').forEach(cb => {
    const id = parseInt(cb.getAttribute('data-idregra'), 10);
    if (!Number.isNaN(id)) out.push(id);
  });
  return out;
},
refreshConfigView: function(delayMs){
  var d = (typeof delayMs === 'number' ? delayMs : 250);

  // guarda estado atual da DataTable (se existir)
  try{
    if ($.fn.DataTable.isDataTable('#configRulesTable')) {
      const api = $('#configRulesTable').DataTable();
      this._dtStateConfig = {
        page  : api.page(),
        length: api.page.len(),
        order : api.order(),
        search: api.search()
      };
    }
  }catch(e){}

  setTimeout(() => this.carregarAbaConfiguracoes(), d);
},
// ========= Desvincular e-mail (ícone da chip) =========
desvincularEmailDeRegra: function(idRegra, idEmail, onDone){
  console.group("[Config] desvincularEmailDeRegra()", { idRegra, idEmail });

  const modal = FLUIGC.modal({
    title: "Confirmar",
    content: "<p>Confirma desvincular este e-mail da regra?</p>",
    id: "confirmUnlinkEmail",
    actions: [
      { label: "Sim", bind: "data-ok", classType: "btn-primary" },
      { label: "Não", bind: "data-cancel", classType: "btn-secondary" }
    ]
  });

  document.querySelector("#confirmUnlinkEmail [data-cancel]").onclick = () => modal.remove();
  document.querySelector("#confirmUnlinkEmail [data-ok]").onclick = () => {
    try {
      const idR = parseInt(idRegra, 10), idE = parseInt(idEmail, 10);
      if (Number.isNaN(idR) || Number.isNaN(idE)) throw new Error("IDs inválidos");

      const res = this.execRmDml(`DELETE FROM ZMD_BC_RELEMAILSREGRAS WHERE IDREGRAS=${idR} AND IDEMAIL=${idE}`);
      if (res.error) {
        FLUIGC.toast({ message: `Falha ao desvincular e-mail: ${res.message || res.error}`, type: "danger" });
      } else {
        FLUIGC.toast({ message: `E-mail desvinculado.`, type: "success" });
        if (typeof onDone === 'function') onDone();
        this.refreshConfigView(250);;
      }
    } catch (e) {
      console.error("[Config] Erro ao desvincular e-mail:", e);
      FLUIGC.toast({ message: "Erro ao desvincular e-mail. Veja o console.", type: "danger" });
    } finally {
      modal.remove();
      console.groupEnd();
    }
  };
},
// ========= Desvincular classificação (ícone da chip) =========
desvincularClassificacaoDeRegra: function(idRegra, idClass, onDone){
  console.group("[Config] desvincularClassificacaoDeRegra()", { idRegra, idClass });

  const modal = FLUIGC.modal({
    title: "Confirmar",
    content: "<p>Confirma desvincular esta classificação da regra?</p>",
    id: "confirmUnlinkClass",
    actions: [
      { label: "Sim", bind: "data-ok", classType: "btn-primary" },
      { label: "Não", bind: "data-cancel", classType: "btn-secondary" }
    ]
  });

  document.querySelector("#confirmUnlinkClass [data-cancel]").onclick = () => modal.remove();
  document.querySelector("#confirmUnlinkClass [data-ok]").onclick = () => {
    try {
      const idR = parseInt(idRegra, 10), idC = parseInt(idClass, 10);
      if (Number.isNaN(idR) || Number.isNaN(idC)) throw new Error("IDs inválidos");

      const res = this.execRmDml(`DELETE FROM ZMD_BC_RELCLASSIFICACAOREGRA WHERE IDREGRAS=${idR} AND IDCLASSIFICACAO=${idC}`);
      if (res.error) {
        FLUIGC.toast({ message: `Falha ao desvincular classificação: ${res.message || res.error}`, type: "danger" });
      } else {
        FLUIGC.toast({ message: `Classificação desvinculada.`, type: "success" });
        if (typeof onDone === 'function') onDone();
        this.refreshConfigView(250);;
      }
    } catch (e) {
      console.error("[Config] Erro ao desvincular classificação:", e);
      FLUIGC.toast({ message: "Erro ao desvincular classificação. Veja o console.", type: "danger" });
    } finally {
      modal.remove();
      console.groupEnd();
    }
  };
},
// ========= Desativar regras selecionadas (SOMENTE da aba Config) =========
DesativarRegrasSelecionadasConfig: function(){
  console.group("[Config] DesativarRegrasSelecionadasConfig()");
  const selecionadas = Array.from(document.querySelectorAll("#configRulesTable .ruleCheckbox:checked"))
    .map(cb => parseInt(cb.getAttribute("data-idregra"), 10))
    .filter(n => !Number.isNaN(n));
  if (!selecionadas.length) {
    FLUIGC.toast({ message:"Nenhuma regra selecionada.", type:"warning" });
    console.groupEnd();
    return;
  }

  const modal = FLUIGC.modal({
    title: "Confirmação",
    content: `
      <p>Tem certeza que deseja desativar as regras selecionadas?</p>
      <p><small>IDs: ${selecionadas.join(", ")}</small></p>`,
    id: "confirmDesativarRegrasCfg",
    actions: [
      { label: "Sim", bind: "data-ok", classType: "btn-primary" },
      { label: "Não", bind: "data-cancel", classType: "btn-secondary" }
    ]
  });

  const rememberTab = () => {
    let tabToRestore = '#tab-config';
    try {
      const activeA = document.querySelector('.nav-tabs li.active a, .nav.nav-tabs .active a');
      const href = activeA && (activeA.getAttribute('href') || activeA.dataset.target);
      if (href) tabToRestore = href;
    } catch(_) {}
    sessionStorage.setItem('audit_active_tab', tabToRestore);
  };

  const cleanupBackdrops = () => {
    try {
      document.querySelectorAll('.modal-backdrop').forEach(el => el.remove());
      document.body.classList.remove('modal-open');
      document.body.style.paddingRight = "";
      document.body.style.overflow = "";
    } catch(_){}
  };

  document.querySelector("#confirmDesativarRegrasCfg [data-cancel]").onclick = () => modal.remove();
  document.querySelector("#confirmDesativarRegrasCfg [data-ok]").onclick = () => {
    try {
      const sql = `UPDATE ZMD_BC_REGRAS SET ATIVO = 0 WHERE IDREGRAS IN (${selecionadas.join(",")});`;
      console.log("[Config][DesativarRegras][SQL]:\n" + sql);
      DatasetFactory.getDataset(this.DATASET_RM, [this.JDBC_RM, sql], null, null);
      FLUIGC.toast({ message:"Regras desativadas.", type:"success" });

      // lembrar aba e recarregar
      rememberTab();
      setTimeout(() => {
        try { modal.remove(); } catch(_) {}
        cleanupBackdrops();
        window.location.reload();
      }, 80);

    } catch(e){
      console.error(e);
      FLUIGC.toast({ message:"Falha ao desativar. Veja o console.", type:"danger" });
    } finally {
      console.groupEnd();
    }
  };
},

initConfigDataTable: function () {
  var self = this;
  var $tbl = $('#configRulesTable');

  if ($.fn.DataTable.isDataTable($tbl)) {
    try { $tbl.DataTable().off('draw.dt'); } catch (e) {}
    $tbl.DataTable().destroy();
  }

  var dt = $tbl.DataTable({
    autoWidth: false,
    pageLength: 10,
    lengthMenu: [10, 20, 25, 50, 100, 250],
    order: [[2, 'asc']],
    columnDefs: [
      { targets: 0, orderable:false, searchable:false, width:28 },
      { targets: 1, orderable:true,  searchable:true, width:60, className:'text-center' },
      { targets: 2, orderable:true,  searchable:true  },
      { targets: 3, orderable:false, searchable:true, width:70, className:'text-center' },
      { targets: 4, orderable:true,  searchable:true },
      { targets: 5, orderable:true,  searchable:true, width:120, className:'text-center' }
    ],
    language: {
      decimal:",", thousands:".",
      lengthMenu:"Exibir _MENU_ registros",
      zeroRecords:"Nenhum registro encontrado",
      info:"Exibindo _START_ a _END_ de _TOTAL_",
      infoEmpty:"Exibindo 0 a 0 de 0",
      infoFiltered:"(filtrado de _MAX_ no total)",
      paginate:{ first:"Primeiro", last:"Último", next:"Próximo", previous:"Anterior" },
      processing:"Processando...",
      search:"Buscar:"
    },
    dom:
      "<'row'<'col-sm-12 col-md-6'l><'col-sm-12 col-md-6'>>" +
      "<'row'<'col-sm-12 col-md-12'f>>" +
      "tr<'row'<'col-sm-12 col-md-5'i><'col-sm-12 col-md-7'p>>",
    initComplete: function () { self.rebindConfigTooltips(); },
    drawCallback : function () { self.rebindConfigTooltips(); }
  });

  // reaplica estado salvo (se houver)
  if (this._dtStateConfig) {
    const s = this._dtStateConfig; delete this._dtStateConfig;
    try {
      if (s.length) dt.page.len(s.length).draw(false);
      if (s.order)  dt.order(s.order).draw(false);
      if (s.search) dt.search(s.search).draw(false);
      if (typeof s.page === 'number') dt.page(s.page).draw('page');
    } catch(e){}
  }

  this.dtConfig = dt;
  
  // Aplicar estilos aos controles da DataTable
  const $lenWrap = $('#configRulesTable_wrapper .dataTables_length');
  $lenWrap.find('select').addClass('form-control input-sm').css({ width: '120px', display: 'inline-block', margin: '0 6px' });
  $lenWrap.find('label').css({ whiteSpace: 'nowrap' });

  const $filterWrap = $('#configRulesTable_wrapper .dataTables_filter');
  $filterWrap.find('input').addClass('form-control input-sm').attr('placeholder', 'Buscar em todas as colunas...').css({ width: '280px', display: 'inline-block', marginLeft: '6px' });
  
  // Aplicar highlight de texto
  this.applyHighlightToConfigTable(dt);
},
rebindConfigTooltips: function () {
  var $scope = $("#configRulesTable");
  if (!$scope.length || !$.fn.tooltip) return;

  var $wrap = $('#configRulesTable_wrapper');
  $wrap.css('position','relative');

  setTimeout(function(){
    try{
      $scope.find('[data-toggle="tooltip"]').tooltip({
        container : $wrap,
        boundary  : $wrap[0],
        html      : true,
        placement : 'auto',
        animation : false,
        trigger   : 'hover focus'
      }).each(function(){ try { $(this).tooltip('fixTitle'); } catch(e){} });
    }catch(e){ console.warn('[tooltip] rebind warning', e); }
  }, 0);
},
injectConfigCss: function(){
  if (document.getElementById('chips-css')) return;
  const st = document.createElement('style');
  st.id = 'chips-css';
  st.textContent = `
    .class-cell .chip{
      display:inline-block; background:#eef1f7; border-radius:16px;
      padding:4px 8px; margin:4px 6px 4px 0; transition:background .15s ease, box-shadow .15s ease;
      border:1px solid #e3e8f5;
    }
    .class-cell .chip:hover{
      background:#e9eefc; box-shadow:0 1px 2px rgba(0,0,0,.06);
    }
    .class-cell .chip .unlink-class{
      margin-left:6px; cursor:pointer; transition:transform .12s ease, opacity .12s ease;
    }
    .class-cell .chip .unlink-class:hover{ transform:scale(1.12); opacity:.85; }
  `;
  document.head.appendChild(st);
},
abrirModalEmailsRegra: function(idRegra){
  console.group("[Config] abrirModalEmailsRegra()", { idRegra });
  try{
    const emails = this.queryRMConfig(`
      SELECT e.IDEMAIL, e.EMAIL
        FROM ZMD_BC_RELEMAILSREGRAS re
        JOIN ZMD_BC_EMAILSREGRAS e ON e.IDEMAIL = re.IDEMAIL
       WHERE re.IDREGRAS = ${parseInt(idRegra,10)}
       ORDER BY e.EMAIL;`);

    const chipsEmails = (emails && emails.length)
      ? emails.map(e => `
          <span class="chip" data-idemail="${e.IDEMAIL}">
            ${escHtml(e.EMAIL)}
            <i class="fluigicon fluigicon-remove icon-sm rm-vinc-email" title="Desvincular"></i>
          </span>`).join(" ")
      : `<span class="text-muted">Nenhum e-mail vinculado.</span>`;

    const modal = FLUIGC.modal({
      title: `E-mails vinculados — Regra #${idRegra}`,
      id: "modalEmailsRegra",
      size: "large",
      content: `
        <style>
          #modalEmailsRegra .chip{display:inline-block;background:#eef1f7;border-radius:16px;padding:4px 8px;margin:4px 6px 4px 0}
          #modalEmailsRegra .chip i{ margin-left:6px; cursor:pointer; }
          #modalEmailsRegra .chip i:hover{ transform:scale(1.08); opacity:.85; }
        </style>
        <div style="margin-top:5px;">
          <h5><strong>E-mails</strong></h5>
          <div id="listEmailsRegra">${chipsEmails}</div>
          <p class="text-muted" style="margin-top:8px;">(Para adicionar e-mails use os seletores acima da tabela.)</p>
        </div>`,
      actions: [{ label: "Fechar", bind: "data-close", classType: "btn-secondary" }]
    });

    const refresh = () => { modal.remove(); this.abrirModalEmailsRegra(idRegra); };

    $(document)
      .off('click.rmemail')
      .on('click.rmemail', '#modalEmailsRegra .rm-vinc-email', (ev) => {
        const idEmail = $(ev.currentTarget).closest('.chip').data('idemail');
        this.desvincularEmailDeRegra(idRegra, idEmail, refresh);
      });

    $('#modalEmailsRegra [data-close]').on('click', () => modal.remove());

  }catch(e){
    console.error(e);
    FLUIGC.toast({ message: "Erro ao abrir e-mails da regra. Veja o console.", type: "danger" });
  }finally{
    console.groupEnd();
  }
},
// Executa DML (INSERT/UPDATE/DELETE) e **sempre** retorna um resultset
// com AFFECTED / ERROR / MESSAGE. Remove ';' do fim por segurança.
execRmDml: function (sqlRaw) {
  const base = String(sqlRaw || "").trim().replace(/;+\s*$/,'');
  const wrapped = `
BEGIN TRY
  SET NOCOUNT ON;
  ${base};
  SELECT CAST(@@ROWCOUNT AS INT) AS AFFECTED,
         CAST(0 AS INT)         AS ERROR,
         CAST('' AS NVARCHAR(4000)) AS MESSAGE;
END TRY
BEGIN CATCH
  SELECT CAST(0 AS INT) AS AFFECTED,
         ERROR_NUMBER() AS ERROR,
         ERROR_MESSAGE() AS MESSAGE;
END CATCH`;
  console.log("[RM][DML][SQL]:\n" + wrapped);
  try {
    const ds = DatasetFactory.getDataset(MyWidget.DATASET_RM, [MyWidget.JDBC_RM, wrapped], null, null);
    console.log("[RM][DML][RETORNO]:", ds);
    const row = ds && ds.values && ds.values[0] || {};
    return {
      affected: parseInt(row.AFFECTED || 0, 10) || 0,
      error: parseInt(row.ERROR || 0, 10) || 0,
      message: String(row.MESSAGE || "")
    };
  } catch (e) {
    console.error("[RM][DML][ERRO]:", e);
    return { affected: 0, error: -1, message: (e && e.message) || "Falha no dataset" };
  }
},



///// DASHBOARD (gráficos + cards) /////

// ============== HELPERS NOVOS (dentro de MyWidget) ==============

// Execução simples de SQL no RM e retorno como array de objetos
queryRM: function(sql){
  try{
    const ds = DatasetFactory.getDataset(this.DATASET_RM, [this.JDBC_RM, sql], null, null);
    const result = (ds && ds.values) ? ds.values : [];
    return result;
  }catch(e){
    console.error("queryRM error:", e, "\nSQL:", sql);
    return [];
  }
},

// Datas padrão: últimos 30 dias
_dbDefaultDates: function(){
  const today = new Date();
  const dtAte = today.toISOString().slice(0,10);
  const d0 = new Date(today.getTime() - 29*24*60*60*1000);
  const dtDe = d0.toISOString().slice(0,10);
  return { de: dtDe, ate: dtAte };
},

// Lê datas dos inputs; se vazio, aplica padrão
_dbReadDates: function(){
  const $de  = document.getElementById("dbDateDe");
  const $ate = document.getElementById("dbDateAte");
  let de  = ($de && $de.value)  ? $de.value  : null;
  let ate = ($ate && $ate.value) ? $ate.value : null;
  if(!de || !ate){
    const d = this._dbDefaultDates();
    de = de || d.de;
    ate = ate || d.ate;
    if($de && !$de.value)  $de.value  = d.de;
    if($ate && !$ate.value) $ate.value = d.ate;
  }
  return { de, ate };
},

// Gerencia instâncias de Chart p/ destruir antes de redesenhar
_dbCharts: {},

_dbDestroy: function(key){
  try{
    if(this._dbCharts[key]){
      this._dbCharts[key].destroy();
      delete this._dbCharts[key];
    }
  }catch(e){ console.warn("destroy chart", key, e); }
},

// Destrói todos os gráficos
_dbDestroyAll: function(){
  Object.keys(this._dbCharts).forEach(key => this._dbDestroy(key));
},

// Gráfico de barras simples
_dbBar: function(canvasId, labels, series, label){
  const ctx = document.getElementById(canvasId).getContext("2d");
  this._dbDestroy(canvasId);
  this._dbCharts[canvasId] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: label || 'Ocorrências',
        data: series,
        borderWidth: 1,
        backgroundColor: 'rgba(54, 162, 235, 0.8)',
        borderColor: 'rgba(54, 162, 235, 1)'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: true },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y}`
          }
        }
      },
      scales: {
        x: { 
          ticks: { autoSkip: false, maxRotation: 45, minRotation: 0 }, 
          grid: { display: false } 
        },
        y: { beginAtZero: true }
      }
    }
  });
},

// Gráfico de barras empilhadas
_dbStackedBar: function(canvasId, labels, datasets, title){
  const ctx = document.getElementById(canvasId).getContext("2d");
  this._dbDestroy(canvasId);
  this._dbCharts[canvasId] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: datasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: {
          display: !!title,
          text: title
        },
        legend: { display: true },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y}`
          }
        }
      },
      scales: {
        x: { 
          stacked: true,
          ticks: { autoSkip: false, maxRotation: 45, minRotation: 0 } 
        },
        y: { 
          stacked: true,
          beginAtZero: true 
        }
      }
    }
  });
},

// Gráfico de linha
_dbLine: function(canvasId, labels, datasets, title){
  const ctx = document.getElementById(canvasId).getContext("2d");
  this._dbDestroy(canvasId);
  this._dbCharts[canvasId] = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: datasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: {
          display: !!title,
          text: title
        },
        legend: { display: true },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y}`
          }
        }
      },
      scales: {
        x: { 
          ticks: { autoSkip: false, maxRotation: 45, minRotation: 0 } 
        },
        y: { beginAtZero: true }
      }
    }
  });
},

// Cores para os status
_dbStatusColors: {
  'EM ANÁLISE': 'rgba(200, 134, 148, 0.8)',
  'EM ANALISE': 'rgba(200, 134, 148, 0.8)',
  'CORRIGIDO': 'rgba(253, 126, 20, 0.8)', // Laranja
  'DESCARTADO': 'rgba(255, 193, 7, 0.8)', // Amarelo (mantido como estava)
  'FINALIZADO': 'rgba(111, 66, 193, 0.8)', // Roxo
  'INCONSISTENTE': 'rgba(23, 162, 184, 0.8)', // Azul (mantido como estava)
  'RESOLVIDO': 'rgba(40, 167, 69, 0.8)' // Verde
},

// Gera cor aleatória para gráficos
_getRandomColor: function() {
  const colors = [
    'rgba(54, 162, 235, 0.8)',
    'rgba(255, 99, 132, 0.8)',
    'rgba(75, 192, 192, 0.8)',
    'rgba(255, 159, 64, 0.8)',
    'rgba(153, 102, 255, 0.8)',
    'rgba(255, 205, 86, 0.8)',
    'rgba(201, 203, 207, 0.8)',
    'rgba(255, 99, 132, 0.8)',
    'rgba(54, 162, 235, 0.8)',
    'rgba(255, 159, 64, 0.8)'
  ];
  return colors[Math.floor(Math.random() * colors.length)];
},

// SQLs para os gráficos
_dbSqls: function(de, ate){
  const esc = s => String(s||'').replace(/'/g,"''");
  const wherePeriodo = `WHERE STATUS IN ('D','I','R') AND CAST(DATAEXECUCAO AS DATE) >= '${esc(de)}' AND CAST(DATAEXECUCAO AS DATE) <= '${esc(ate)}'`;

  // SQL 1: Resumo geral por status
  const sqlResumo = `
    SELECT 
      CASE
        WHEN STATUS IS NULL THEN 'EM ANÁLISE'
        WHEN STATUS = 'A' THEN 'ALTERADO'
        WHEN STATUS = 'C' THEN 'CORRIGIDO'
        WHEN STATUS = 'D' THEN 'DESCARTADO'
        WHEN STATUS = 'F' THEN 'FINALIZADO'
        WHEN STATUS = 'I' THEN 'INCONSISTENTE'
        WHEN STATUS = 'R' THEN 'RESOLVIDO'
      END AS STATUS,
      COUNT(IDRESULTADO) AS QUANTIDADE
    FROM ZMD_BC_RESULTADO
    WHERE CAST(DATAEXECUCAO AS DATE) >= '${esc(de)}' AND CAST(DATAEXECUCAO AS DATE) <= '${esc(ate)}'
    GROUP BY STATUS
    ORDER BY STATUS;
  `;
  console.log("SQL Resumo Geral:", sqlResumo);

  // SQL 2: Total geral
  const sqlTotal = `
    SELECT COUNT(IDRESULTADO) AS TOTAL_OCORRENCIAS_GERAL
    FROM ZMD_BC_RESULTADO
    WHERE CAST(DATAEXECUCAO AS DATE) >= '${esc(de)}' AND CAST(DATAEXECUCAO AS DATE) <= '${esc(ate)}';
  `;
  console.log("SQL Total Geral:", sqlTotal);

  // SQL 3: Auditor por status (D/I)
  const sqlAuditorStatus = `
    SELECT 
      USUARIOALTERACAO AS AUDITOR,
      CASE
        WHEN STATUS IS NULL THEN 'EM ANÁLISE'
        WHEN STATUS = 'A' THEN 'ALTERADO'
        WHEN STATUS = 'C' THEN 'CORRIGIDO'
        WHEN STATUS = 'D' THEN 'DESCARTADO'
        WHEN STATUS = 'F' THEN 'FINALIZADO'
        WHEN STATUS = 'I' THEN 'INCONSISTENTE'
        WHEN STATUS = 'R' THEN 'RESOLVIDO'
      END STATUS,
      COUNT(IDRESULTADO) AS QUANTIDADE
    FROM ZMD_BC_RESULTADO
    ${wherePeriodo}
    GROUP BY USUARIOALTERACAO, STATUS
    ORDER BY USUARIOALTERACAO, STATUS;
  `;
  console.log("SQL Auditor por Status:", sqlAuditorStatus);

  // SQL 4: Auditor por status por regra (D/I)
  const sqlAuditorStatusRegra = `
    SELECT 
      IDREGRA AS REGRA,
      USUARIOALTERACAO AS AUDITOR,
      CASE
        WHEN STATUS IS NULL THEN 'EM ANÁLISE'
        WHEN STATUS = 'A' THEN 'ALTERADO'
        WHEN STATUS = 'C' THEN 'CORRIGIDO'
        WHEN STATUS = 'D' THEN 'DESCARTADO'
        WHEN STATUS = 'F' THEN 'FINALIZADO'
        WHEN STATUS = 'I' THEN 'INCONSISTENTE'
        WHEN STATUS = 'R' THEN 'RESOLVIDO'
      END STATUS,
      COUNT(IDRESULTADO) AS QUANTIDADE
    FROM ZMD_BC_RESULTADO
    ${wherePeriodo}
    GROUP BY IDREGRA, USUARIOALTERACAO, STATUS
    ORDER BY IDREGRA, USUARIOALTERACAO, STATUS;
  `;
  console.log("SQL Auditor por Status por Regra:", sqlAuditorStatusRegra);

  // SQL 5: Ocorrências por regra
  const sqlOcorrenciasRegra = `
    SELECT 
      R.IDREGRA AS REGRA,
      RE.TITULOREGRA AS TITULO,
      COUNT(R.IDRESULTADO) AS QUANTIDADE
    FROM ZMD_BC_RESULTADO R
    LEFT JOIN ZMD_BC_REGRAS RE ON R.IDREGRA = RE.IDREGRAS
    WHERE CAST(R.DATAEXECUCAO AS DATE) >= '${esc(de)}' AND CAST(R.DATAEXECUCAO AS DATE) <= '${esc(ate)}'
    GROUP BY R.IDREGRA, RE.TITULOREGRA
    ORDER BY R.IDREGRA;
  `;
  console.log("SQL Ocorrências por Regra:", sqlOcorrenciasRegra);

  // SQL 6: Evolução temporal por regra
  const sqlEvolucaoTemporal = `
    SELECT 
      R.IDREGRA AS REGRA,
      RE.TITULOREGRA AS TITULO,
      CONVERT(VARCHAR, R.DATAEXECUCAO, 103) AS DATA,
      COUNT(R.IDRESULTADO) AS QUANTIDADE
    FROM ZMD_BC_RESULTADO R
    JOIN ZMD_BC_REGRAS RE ON R.IDREGRA = RE.IDREGRAS
    WHERE CAST(R.DATAEXECUCAO AS DATE) >= '${esc(de)}' AND CAST(R.DATAEXECUCAO AS DATE) <= '${esc(ate)}'
    GROUP BY R.IDREGRA, RE.TITULOREGRA, CONVERT(VARCHAR, R.DATAEXECUCAO, 103)
    ORDER BY R.IDREGRA, CONVERT(VARCHAR, R.DATAEXECUCAO, 103);
  `;
  console.log("SQL Evolução Temporal:", sqlEvolucaoTemporal);

  // SQL 7: Status por regra por data
  const sqlStatusRegraData = `
    SELECT 
      R.IDREGRA AS REGRA,
      REGRAS.TITULOREGRA AS TITULO,
      CONVERT(VARCHAR, R.DATAEXECUCAO, 103) AS DATA,
      CASE
        WHEN R.STATUS IS NULL THEN 'EM ANALISE'
        WHEN R.STATUS = 'C' THEN 'CORRIGIDO'
        WHEN R.STATUS = 'D' THEN 'DESCARTADO'
        WHEN R.STATUS = 'F' THEN 'FINALIZADO'
        WHEN R.STATUS = 'I' THEN 'INCONSISTENTE'
        WHEN R.STATUS = 'R' THEN 'RESOLVIDO'
      END STATUS,
      COUNT(R.IDRESULTADO) AS QUANTIDADE
    FROM ZMD_BC_RESULTADO R
    JOIN ZMD_BC_REGRAS REGRAS ON R.IDREGRA = REGRAS.IDREGRAS
    WHERE CAST(R.DATAEXECUCAO AS DATE) >= '${esc(de)}' AND CAST(R.DATAEXECUCAO AS DATE) <= '${esc(ate)}'
    GROUP BY R.IDREGRA, REGRAS.TITULOREGRA, CONVERT(VARCHAR, R.DATAEXECUCAO, 103), R.STATUS
    ORDER BY R.IDREGRA, CONVERT(VARCHAR, R.DATAEXECUCAO, 103);
  `;
  console.log("SQL Status por Regra por Data:", sqlStatusRegraData);

  return { 
    sqlResumo, 
    sqlTotal, 
    sqlAuditorStatus, 
    sqlAuditorStatusRegra, 
    sqlOcorrenciasRegra, 
    sqlEvolucaoTemporal, 
    sqlStatusRegraData 
  };
},

// Nova versão de SQLs para os gráficos (deduplicadas por HASH)
_dbSqls_dedup: function(de, ate){
  const esc = s => String(s||'').replace(/'/g,"''");

  // 1) Resumo geral por status (deduplicado por HASH no período)
  const sqlResumo = `
    WITH base AS (
      SELECT *,
             ROW_NUMBER() OVER (
               PARTITION BY HASHRESULTADO
               ORDER BY DATAEXECUCAO DESC, IDRESULTADO DESC
             ) AS rn
      FROM ZMD_BC_RESULTADO
      WHERE CAST(DATAEXECUCAO AS DATE) >= '${esc(de)}'
        AND CAST(DATAEXECUCAO AS DATE) <= '${esc(ate)}'
    )
    SELECT 
      CASE
        WHEN STATUS IS NULL THEN 'EM AN�LISE'
        WHEN STATUS = 'A' THEN 'ALTERADO'
        WHEN STATUS = 'C' THEN 'CORRIGIDO'
        WHEN STATUS = 'D' THEN 'DESCARTADO'
        WHEN STATUS = 'F' THEN 'FINALIZADO'
        WHEN STATUS = 'I' THEN 'INCONSISTENTE'
        WHEN STATUS = 'R' THEN 'RESOLVIDO'
      END AS STATUS,
      COUNT(*) AS QUANTIDADE
    FROM base
    WHERE rn = 1 AND REGISTRO IS NOT NULL
    GROUP BY 
      CASE
        WHEN STATUS IS NULL THEN 'EM AN�LISE'
        WHEN STATUS = 'A' THEN 'ALTERADO'
        WHEN STATUS = 'C' THEN 'CORRIGIDO'
        WHEN STATUS = 'D' THEN 'DESCARTADO'
        WHEN STATUS = 'F' THEN 'FINALIZADO'
        WHEN STATUS = 'I' THEN 'INCONSISTENTE'
        WHEN STATUS = 'R' THEN 'RESOLVIDO'
      END
    ORDER BY STATUS;
  `;
  console.log("SQL Resumo Geral (dedup):", sqlResumo);

  // Versão ajustada do Resumo (base D/I/R + base1 A/C/F/NULL) com dedup por HASH
  const sqlResumo2 = `
    WITH base AS (
      SELECT *,
             ROW_NUMBER() OVER (
               PARTITION BY HASHRESULTADO
               ORDER BY DATAEXECUCAO DESC, IDRESULTADO DESC
             ) AS rn
      FROM ZMD_BC_RESULTADO
      WHERE CAST(DATAEXECUCAO AS DATE) >= '${esc(de)}'
        AND CAST(DATAEXECUCAO AS DATE) <= '${esc(ate)}'
        AND STATUS IN ('D','I','R')
    ),
    base1 AS (
      SELECT *,
             ROW_NUMBER() OVER (
               PARTITION BY HASHRESULTADO
               ORDER BY DATAEXECUCAO DESC, IDRESULTADO DESC
             ) AS rn
      FROM ZMD_BC_RESULTADO
      WHERE CAST(DATAEXECUCAO AS DATE) >= '${esc(de)}'
        AND CAST(DATAEXECUCAO AS DATE) <= '${esc(ate)}'
        AND (STATUS IN ('C','F','A') OR (STATUS IS NULL))
    )
    SELECT 
      CASE
        WHEN STATUS = 'D' THEN 'DESCARTADO'
        WHEN STATUS = 'I' THEN 'INCONSISTENTE'
        WHEN STATUS = 'R' THEN 'RESOLVIDO'
      END AS STATUS,
      COUNT(*) AS QUANTIDADE
    FROM base
    WHERE rn = 1 AND REGISTRO IS NOT NULL
    GROUP BY 
      CASE
        WHEN STATUS = 'D' THEN 'DESCARTADO'
        WHEN STATUS = 'I' THEN 'INCONSISTENTE'
        WHEN STATUS = 'R' THEN 'RESOLVIDO'
      END
    UNION ALL
    SELECT 
      CASE
        WHEN STATUS IS NULL THEN 'EM ANÁLISE'
        WHEN STATUS = 'A' THEN 'ALTERADO'
        WHEN STATUS = 'C' THEN 'CORRIGIDO'
        WHEN STATUS = 'F' THEN 'FINALIZADO'
      END AS STATUS,
      COUNT(*) AS QUANTIDADE
    FROM base1
    WHERE rn = 1 AND REGISTRO IS NOT NULL
    GROUP BY 
      CASE
        WHEN STATUS IS NULL THEN 'EM ANÁLISE'
        WHEN STATUS = 'A' THEN 'ALTERADO'
        WHEN STATUS = 'C' THEN 'CORRIGIDO'
        WHEN STATUS = 'F' THEN 'FINALIZADO'
      END
    ORDER BY STATUS;
  `;
  console.log("SQL Resumo Geral (dedup, v2):", sqlResumo2);

  // 2) Total geral (deduplicado por HASH no período)
  const sqlTotal = `
    WITH base AS (
      SELECT HASHRESULTADO,
             ROW_NUMBER() OVER (
               PARTITION BY HASHRESULTADO
               ORDER BY DATAEXECUCAO DESC, IDRESULTADO DESC
             ) AS rn
      FROM ZMD_BC_RESULTADO
      WHERE CAST(DATAEXECUCAO AS DATE) >= '${esc(de)}'
        AND CAST(DATAEXECUCAO AS DATE) <= '${esc(ate)}'
    )
    SELECT COUNT(*) AS TOTAL_OCORRENCIAS_GERAL
    FROM base
    WHERE rn = 1;
  `;
  console.log("SQL Total Geral (dedup):", sqlTotal);

  // 3) Auditor por status (D/I/R), deduplicado por HASH no período
  const sqlAuditorStatus = `
    WITH base AS (
      SELECT USUARIOALTERACAO, STATUS, HASHRESULTADO,
             ROW_NUMBER() OVER (
               PARTITION BY HASHRESULTADO
               ORDER BY DATAEXECUCAO DESC, IDRESULTADO DESC
             ) AS rn
      FROM ZMD_BC_RESULTADO
      WHERE CAST(DATAEXECUCAO AS DATE) >= '${esc(de)}'
        AND CAST(DATAEXECUCAO AS DATE) <= '${esc(ate)}'
        AND STATUS IN ('D','I','R')
    )
    SELECT 
      USUARIOALTERACAO AS AUDITOR,
      CASE WHEN STATUS = 'D' THEN 'DESCARTADO'
           WHEN STATUS = 'I' THEN 'INCONSISTENTE'
           WHEN STATUS = 'R' THEN 'RESOLVIDO' END STATUS,
      COUNT(*) AS QUANTIDADE
    FROM base
    WHERE rn = 1
    GROUP BY USUARIOALTERACAO,
      CASE WHEN STATUS = 'D' THEN 'DESCARTADO'
           WHEN STATUS = 'I' THEN 'INCONSISTENTE'
           WHEN STATUS = 'R' THEN 'RESOLVIDO' END
    ORDER BY USUARIOALTERACAO, STATUS;
  `;
  console.log("SQL Auditor por Status (dedup):", sqlAuditorStatus);

  // 4) Auditor por status por regra (D/I/R), deduplicado por HASH no período
  const sqlAuditorStatusRegra = `
    WITH base AS (
      SELECT IDREGRA, USUARIOALTERACAO, STATUS, HASHRESULTADO,
             ROW_NUMBER() OVER (
               PARTITION BY HASHRESULTADO
               ORDER BY DATAEXECUCAO DESC, IDRESULTADO DESC
             ) AS rn
      FROM ZMD_BC_RESULTADO
      WHERE CAST(DATAEXECUCAO AS DATE) >= '${esc(de)}'
        AND CAST(DATAEXECUCAO AS DATE) <= '${esc(ate)}'
        AND STATUS IN ('D','I','R')
    )
    SELECT 
      IDREGRA AS REGRA,
      USUARIOALTERACAO AS AUDITOR,
      CASE WHEN STATUS = 'D' THEN 'DESCARTADO'
           WHEN STATUS = 'I' THEN 'INCONSISTENTE'
           WHEN STATUS = 'R' THEN 'RESOLVIDO' END STATUS,
      COUNT(*) AS QUANTIDADE
    FROM base
    WHERE rn = 1
    GROUP BY IDREGRA, USUARIOALTERACAO,
      CASE WHEN STATUS = 'D' THEN 'DESCARTADO'
           WHEN STATUS = 'I' THEN 'INCONSISTENTE'
           WHEN STATUS = 'R' THEN 'RESOLVIDO' END
    ORDER BY IDREGRA, USUARIOALTERACAO, STATUS;
  `;
  console.log("SQL Auditor por Status por Regra (dedup):", sqlAuditorStatusRegra);

  // 5) Ocorr�ncias por regra (deduplicado por HASH no período)
  const sqlOcorrenciasRegra = `
    WITH base AS (
      SELECT IDREGRA, HASHRESULTADO,
             ROW_NUMBER() OVER (
               PARTITION BY HASHRESULTADO
               ORDER BY DATAEXECUCAO DESC, IDRESULTADO DESC
             ) AS rn
      FROM ZMD_BC_RESULTADO
      WHERE CAST(DATAEXECUCAO AS DATE) >= '${esc(de)}'
        AND CAST(DATAEXECUCAO AS DATE) <= '${esc(ate)}'
    )
    SELECT 
      R.IDREGRA AS REGRA,
      RE.TITULOREGRA AS TITULO,
      COUNT(*) AS QUANTIDADE
    FROM base R
    LEFT JOIN ZMD_BC_REGRAS RE ON R.IDREGRA = RE.IDREGRAS
    WHERE R.rn = 1
    GROUP BY R.IDREGRA, RE.TITULOREGRA
    ORDER BY R.IDREGRA;
  `;
  console.log("SQL Ocorr�ncias por Regra (dedup):", sqlOcorrenciasRegra);

  // 6) Evolu��o temporal por regra (por DIA; deduplica �ltimo por HASH no dia)
  const sqlEvolucaoTemporal = `
    WITH dia AS (
      SELECT R.IDREGRA,
             R.HASHRESULTADO,
             CAST(R.DATAEXECUCAO AS DATE) AS DIA,
             ROW_NUMBER() OVER (
               PARTITION BY CAST(R.DATAEXECUCAO AS DATE), R.HASHRESULTADO
               ORDER BY R.DATAEXECUCAO DESC, R.IDRESULTADO DESC
             ) AS rn
      FROM ZMD_BC_RESULTADO R
      WHERE CAST(R.DATAEXECUCAO AS DATE) >= '${esc(de)}'
        AND CAST(R.DATAEXECUCAO AS DATE) <= '${esc(ate)}'
    )
    SELECT 
      d.IDREGRA AS REGRA,
      RE.TITULOREGRA AS TITULO,
      CONVERT(VARCHAR, d.DIA, 103) AS DATA,
      COUNT(*) AS QUANTIDADE
    FROM dia d
    JOIN ZMD_BC_REGRAS RE ON d.IDREGRA = RE.IDREGRAS
    WHERE d.rn = 1
    GROUP BY d.IDREGRA, RE.TITULOREGRA, CONVERT(VARCHAR, d.DIA, 103)
    ORDER BY d.IDREGRA, CONVERT(VARCHAR, d.DIA, 103);
  `;
  console.log("SQL Evolu��o Temporal (dedup):", sqlEvolucaoTemporal);

  // 7) Status por regra por data (por DIA; deduplica �ltimo por HASH no dia)
  const sqlStatusRegraData = `
    WITH dia AS (
      SELECT R.IDREGRA,
             R.HASHRESULTADO,
             R.STATUS,
             CAST(R.DATAEXECUCAO AS DATE) AS DIA,
             ROW_NUMBER() OVER (
               PARTITION BY CAST(R.DATAEXECUCAO AS DATE), R.HASHRESULTADO
               ORDER BY R.DATAEXECUCAO DESC, R.IDRESULTADO DESC
             ) AS rn
      FROM ZMD_BC_RESULTADO R
      WHERE CAST(R.DATAEXECUCAO AS DATE) >= '${esc(de)}'
        AND CAST(R.DATAEXECUCAO AS DATE) <= '${esc(ate)}'
    )
    SELECT 
      d.IDREGRA AS REGRA,
      REGRAS.TITULOREGRA AS TITULO,
      CONVERT(VARCHAR, d.DIA, 103) AS DATA,
      CASE
        WHEN d.STATUS IS NULL THEN 'EM ANALISE'
        WHEN d.STATUS = 'C' THEN 'CORRIGIDO'
        WHEN d.STATUS = 'D' THEN 'DESCARTADO'
        WHEN d.STATUS = 'F' THEN 'FINALIZADO'
        WHEN d.STATUS = 'I' THEN 'INCONSISTENTE'
        WHEN d.STATUS = 'R' THEN 'RESOLVIDO'
      END STATUS,
      COUNT(*) AS QUANTIDADE
    FROM dia d
    JOIN ZMD_BC_REGRAS REGRAS ON d.IDREGRA = REGRAS.IDREGRAS
    WHERE d.rn = 1
    GROUP BY d.IDREGRA, REGRAS.TITULOREGRA, CONVERT(VARCHAR, d.DIA, 103),
      CASE
        WHEN d.STATUS IS NULL THEN 'EM ANALISE'
        WHEN d.STATUS = 'C' THEN 'CORRIGIDO'
        WHEN d.STATUS = 'D' THEN 'DESCARTADO'
        WHEN d.STATUS = 'F' THEN 'FINALIZADO'
        WHEN d.STATUS = 'I' THEN 'INCONSISTENTE'
        WHEN d.STATUS = 'R' THEN 'RESOLVIDO'
      END
    ORDER BY d.IDREGRA, CONVERT(VARCHAR, d.DIA, 103);
  `;
  console.log("SQL Status por Regra por Data (dedup):", sqlStatusRegraData);

  return {
    sqlResumo: sqlResumo2,
    sqlTotal,
    sqlAuditorStatus,
    sqlAuditorStatusRegra,
    sqlOcorrenciasRegra,
    sqlEvolucaoTemporal,
    sqlStatusRegraData
  };
},

// Carrega o dashboard completo
carregarDashboard: function(){
  // Inicializa datas default na primeira abertura
  const inputsReady = () => {
    const { de, ate } = this._dbDefaultDates();
    const $de  = document.getElementById("dbDateDe");
    const $ate = document.getElementById("dbDateAte");
    if($de && !$de.value)  $de.value  = de;
    if($ate && !$ate.value) $ate.value = ate;
  };

  const run = () => {
    this.mostrarLoading();
    setTimeout(() => {
      try{
        const { de, ate } = this._dbReadDates();
        
        const { 
          sqlResumo, 
          sqlTotal, 
          sqlAuditorStatus, 
          sqlAuditorStatusRegra, 
          sqlOcorrenciasRegra, 
          sqlEvolucaoTemporal, 
          sqlStatusRegraData 
        } = this._dbSqls_dedup(de, ate);


        // 1) Carregar cards de resumo
        this._carregarCardsResumo(sqlResumo, sqlTotal);

        // 2) Gráfico: Auditor por Status (D/I)
        this._carregarGraficoAuditorStatus(sqlAuditorStatus);

        // 3) Gráfico: Ocorrências por Regra
        this._carregarGraficoOcorrenciasRegra(sqlOcorrenciasRegra);

        // 4) Gráfico: Evolução Temporal por Regra
        this._carregarGraficoEvolucaoTemporal(sqlEvolucaoTemporal);

        // 5) Gráficos: Status por Regra por Data
        this._carregarGraficosStatusRegraData(sqlStatusRegraData);

        // 6) Gráficos: Auditor por Status por Regra
        this._carregarGraficosAuditorRegraStatus(sqlAuditorStatusRegra);


      } catch(e){
        console.error("carregarDashboard error:", e);
        console.error("Stack trace:", e.stack);
        FLUIGC.toast({ message: "Falha ao carregar Dashboard.", type: "danger" });
      } finally {
        this.esconderLoading();
      }
    }, 0);
  };

  // Bind dos botões (uma única vez por vida da aba)
  const $apply = document.getElementById("dbApply");
  const $clear = document.getElementById("dbClear");
  if($apply && !$apply._bound){
    $apply._bound = true;
    $apply.addEventListener("click", run);
  }
  if($clear && !$clear._bound){
    $clear._bound = true;
    $clear.addEventListener("click", () => {
      const { de, ate } = this._dbDefaultDates();
      const $de  = document.getElementById("dbDateDe");
      const $ate = document.getElementById("dbDateAte");
      if($de)  $de.value  = de;
      if($ate) $ate.value = ate;
      run();
    });
  }

  inputsReady();
  run();
},

// Carrega os cards de resumo
_carregarCardsResumo: function(sqlResumo, sqlTotal) {
  try {
    
    // Total geral
    const totRows = this.queryRM(sqlTotal);
    const total = (totRows[0] && (parseInt(totRows[0].TOTAL_OCORRENCIAS_GERAL,10) || 0)) || 0;
    console.log("Total geral de ocorrências:", total);
    const elTot = document.getElementById("cardTotalOcorrencias");
    if(elTot) elTot.textContent = total.toLocaleString('pt-BR');

    // Resumo por status
    const resumoRows = this.queryRM(sqlResumo);
    
    const statusMap = {
      'DESCARTADO': 'cardOcorrenciasDescartadas',
      'INCONSISTENTE': 'cardOcorrenciasInconsistentes',
      'CORRIGIDO': 'cardOcorrenciasCorrigidas',
      'FINALIZADO': 'cardOcorrenciasFaturadas',
      'RESOLVIDO': 'cardOcorrenciasResolvidas'
    };

    resumoRows.forEach(row => {
      const status = row.STATUS;
      const quantidade = parseInt(row.QUANTIDADE, 10) || 0;
      console.log(`Status: ${status}, Quantidade: ${quantidade}`);
      
      const elementId = statusMap[status];
      if(elementId) {
        const el = document.getElementById(elementId);
        if(el) el.textContent = quantidade.toLocaleString('pt-BR');
      }
    });


  } catch(e) {
    console.error("Erro ao carregar cards de resumo:", e);
  }
},

// Carrega gráfico de auditor por status
_carregarGraficoAuditorStatus: function(sql) {
  try {
    const rows = this.queryRM(sql);
    
    // Agrupa dados por auditor
    const auditorData = {};
    rows.forEach(row => {
      const auditor = row.AUDITOR || '—';
      const status = row.STATUS;
      const quantidade = parseInt(row.QUANTIDADE, 10) || 0;
      
      if (!auditorData[auditor]) {
        auditorData[auditor] = {};
      }
      auditorData[auditor][status] = quantidade;
    });



    const auditores = Object.keys(auditorData);
    const statuses = ['DESCARTADO', 'INCONSISTENTE', 'RESOLVIDO'];

    
    const datasets = statuses.map(status => {
      const color = this._dbStatusColors[status];
      if (!color) {
        console.warn(`Cor não encontrada para status: ${status}`);
        return null;
      }
      
      return {
        label: status,
        data: auditores.map(auditor => auditorData[auditor][status] || 0),
        backgroundColor: color,
        borderColor: color.replace('0.8', '1'),
        borderWidth: 1,
        stack: 'stack-1'
      };
    }).filter(dataset => dataset !== null);


    this._dbStackedBar("db_bar_auditor_status", auditores, datasets, "Auditor por Status (Descartado / Inconsistente)");

  } catch(e) {
    console.error("Erro ao carregar gráfico auditor por status:", e);
    console.error("Stack trace:", e.stack);
  }
},

// Carrega gráfico de ocorrências por regra
_carregarGraficoOcorrenciasRegra: function(sql) {
  try {
    const rows = this.queryRM(sql);
    
    // Ordenar por quantidade (decrescente)
    const sortedRows = rows.sort((a, b) => {
      const qtyA = parseInt(a.QUANTIDADE, 10) || 0;
      const qtyB = parseInt(b.QUANTIDADE, 10) || 0;
      return qtyB - qtyA; // Decrescente
    });
    
    const labels = sortedRows.map(r => `ID: ${r.REGRA}`);
    const data = sortedRows.map(r => parseInt(r.QUANTIDADE, 10) || 0);
    const titulos = sortedRows.map(r => r.TITULO || `Regra ${r.REGRA}`);

    // Cria o gráfico com tooltip personalizado
    const ctx = document.getElementById("db_bar_ocorrencias").getContext("2d");
    this._dbDestroy("db_bar_ocorrencias");
    this._dbCharts["db_bar_ocorrencias"] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Ocorrências por Regra',
          data: data,
          borderWidth: 1,
          backgroundColor: 'rgba(54, 162, 235, 0.8)',
          borderColor: 'rgba(54, 162, 235, 1)'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: true },
          tooltip: {
            callbacks: {
              title: (items) => {
                const index = items[0].dataIndex;
                return `Regra ${titulos[index]}`;
              },
              label: (ctx) => `Ocorrências: ${ctx.parsed.y}`
            }
          }
        },
      scales: {
        x: { 
          ticks: { autoSkip: false, maxRotation: 45, minRotation: 0 }, 
          grid: { display: false } 
        },
        y: { beginAtZero: true }
      }
      }
    });


  } catch(e) {
    console.error("Erro ao carregar gráfico ocorrências por regra:", e);
    console.error("Stack trace:", e.stack);
  }
},

// Carrega gráfico de evolução temporal
_carregarGraficoEvolucaoTemporal: function(sql) {
  try {
    const rows = this.queryRM(sql);
    
    // Agrupa dados por regra
    const regraData = {};
    const datas = new Set();
    
    rows.forEach(row => {
      const regra = row.REGRA;
      const titulo = row.TITULO || `Regra ${regra}`;
      const data = row.DATA;
      const quantidade = parseInt(row.QUANTIDADE, 10) || 0;
      
      datas.add(data);
      
      if (!regraData[regra]) {
        regraData[regra] = { titulo, data: {} };
      }
      regraData[regra].data[data] = quantidade;
    });


    // Cria container para os gráficos
    const container = document.getElementById("db_line_regras_data");
    if (!container) {
      console.error("Container db_line_regras_data não encontrado");
      return;
    }
    
    container.innerHTML = '';

    // Criar seletor de regras
    const selectorDiv = document.createElement('div');
    selectorDiv.className = 'col-sm-12';
    selectorDiv.style.marginBottom = '20px';
    selectorDiv.innerHTML = `
      <div class="panel panel-default">
        <div class="panel-heading">
          <h5 style="margin:0;">Selecionar Regras para Visualizar</h5>
          <small>Clique nas regras para adicionar/remover do gráfico</small>
        </div>
        <div class="panel-body">
          <div class="regra-selector" style="display:flex; flex-wrap:wrap; gap:8px;">
            ${Object.keys(regraData).map(regra => {
              const data = regraData[regra];
              return `
                <button class="btn btn-default regra-btn" 
                        data-regra="${regra}" 
                        data-titulo="${data.titulo}"
                        title="${data.titulo}"
                        style="margin:2px; min-width:60px;">
                  ID: ${regra}
                </button>
              `;
            }).join('')}
          </div>
        </div>
      </div>
    `;
    
    container.appendChild(selectorDiv);
    
    // Criar container para o gráfico único
    const chartContainerDiv = document.createElement('div');
    chartContainerDiv.className = 'col-sm-12';
    chartContainerDiv.innerHTML = `
      <div class="panel panel-default">
        <div class="panel-heading">
          <h5 style="margin:0;">Evolução Temporal por Regra</h5>
          <small>Selecione as regras acima para visualizar</small>
        </div>
        <div class="panel-body">
          <div class="chart-container" style="position:relative; height:400px;">
            <canvas id="db_line_evolucao_temporal"></canvas>
          </div>
        </div>
      </div>
    `;
    
    container.appendChild(chartContainerDiv);

    // Armazenar dados para uso posterior
    this._evolucaoTemporalData = {
      regraData: regraData,
      datas: Array.from(datas).sort((a, b) => {
        // Converter datas do formato DD/MM/YYYY para objeto Date para ordenação correta
        const [dayA, monthA, yearA] = a.split('/').map(Number);
        const [dayB, monthB, yearB] = b.split('/').map(Number);
        const dateA = new Date(yearA, monthA - 1, dayA); // month - 1 porque Date usa 0-11 para meses
        const dateB = new Date(yearB, monthB - 1, dayB);
        return dateA - dateB; // Ordem cronológica: data menor à esquerda
      })
    };

    // Adicionar event listeners aos botões
    setTimeout(() => {
      this._bindEvolucaoTemporalButtons();
    }, 100);


  } catch(e) {
    console.error("Erro ao carregar gráfico evolução temporal:", e);
    console.error("Stack trace:", e.stack);
  }
},

// Carrega gráficos de status por regra por data
_carregarGraficosStatusRegraData: function(sql) {
  try {
    const rows = this.queryRM(sql);
    console.log("Rows status por regra por data:", rows);
    
    // Agrupa dados por regra
    const regraData = {};
    rows.forEach(row => {
      const regra = row.REGRA;
      const titulo = row.TITULO || `Regra ${regra}`;
      const data = row.DATA;
      const status = row.STATUS;
      const quantidade = parseInt(row.QUANTIDADE, 10) || 0;
      
      if (!regraData[regra]) {
        regraData[regra] = { titulo, data: {} };
      }
      if (!regraData[regra].data[data]) {
        regraData[regra].data[data] = {};
      }
      regraData[regra].data[data][status] = quantidade;
    });



    // Cria container para os gráficos
    const container = document.getElementById("db_regras_status_data");
    if (!container) {
      console.error("Container db_regras_status_data não encontrado");
      return;
    }
    
    container.innerHTML = '';

    // Criar seletor de regras
    const selectorDiv = document.createElement('div');
    selectorDiv.className = 'col-sm-12';
    selectorDiv.style.marginBottom = '20px';
    selectorDiv.innerHTML = `
      <div class="panel panel-default">
        <div class="panel-heading">
          <h5 style="margin:0;">Selecionar Regras para Visualizar Status</h5>
          <small>Clique nas regras para adicionar/remover do gráfico</small>
        </div>
        <div class="panel-body">
          <div class="regra-selector-status" style="display:flex; flex-wrap:wrap; gap:8px;">
            ${Object.keys(regraData).map(regra => {
              const data = regraData[regra];
              return `
                <button class="btn btn-default regra-btn-status" 
                        data-regra="${regra}" 
                        data-titulo="${data.titulo}"
                        title="${data.titulo}"
                        style="margin:2px; min-width:60px;">
                  ID: ${regra}
                </button>
              `;
            }).join('')}
          </div>
        </div>
      </div>
    `;
    
    container.appendChild(selectorDiv);

    // Criar container para o gráfico único
    const chartContainerDiv = document.createElement('div');
    chartContainerDiv.className = 'col-sm-12';
    chartContainerDiv.innerHTML = `
      <div class="panel panel-default">
        <div class="panel-heading">
          <h5 style="margin:0;">Status por Regra por Data</h5>
          <small>Selecione as regras acima para visualizar</small>
        </div>
        <div class="panel-body">
          <div class="chart-container" style="position:relative; height:400px;">
            <canvas id="db_status_regras_chart"></canvas>
          </div>
        </div>
      </div>
    `;
    
    container.appendChild(chartContainerDiv);

    // Armazenar dados para uso posterior
    this._statusRegraData = {
      regraData: regraData
    };

    // Adicionar event listeners aos botões
    setTimeout(() => {
      this._bindStatusRegraButtons();
    }, 100);


  } catch(e) {
    console.error("Erro ao carregar gráfico status por regra:", e);
    console.error("Stack trace:", e.stack);
  }
},

// Carrega gráficos de auditor por status por regra
_carregarGraficosAuditorRegraStatus: function(sql) {
  try {
    const rows = this.queryRM(sql);
    
    // Agrupa dados por regra
    const regraData = {};
    rows.forEach(row => {
      const regra = row.REGRA;
      const auditor = row.AUDITOR || '—';
      const status = row.STATUS;
      const quantidade = parseInt(row.QUANTIDADE, 10) || 0;
      
      if (!regraData[regra]) {
        regraData[regra] = { data: {} };
      }
      if (!regraData[regra].data[auditor]) {
        regraData[regra].data[auditor] = {};
      }
      regraData[regra].data[auditor][status] = quantidade;
    });



    // Busca títulos das regras
    const titulosRegras = {};
    if (Object.keys(regraData).length > 0) {
      const sqlTitulos = `
        SELECT IDREGRAS, TITULOREGRA 
        FROM ZMD_BC_REGRAS 
        WHERE IDREGRAS IN (${Object.keys(regraData).join(',')})
      `;
      const titulosRows = this.queryRM(sqlTitulos);
      titulosRows.forEach(row => {
        titulosRegras[row.IDREGRAS] = row.TITULOREGRA;
      });
    }

    // Cria container para os gráficos
    const container = document.getElementById("db_auditor_regra_status");
    if (!container) {
      console.error("Container db_auditor_regra_status não encontrado");
      return;
    }
    
    container.innerHTML = '';

    // Criar seletor de regras
    const selectorDiv = document.createElement('div');
    selectorDiv.className = 'col-sm-12';
    selectorDiv.style.marginBottom = '20px';
    selectorDiv.innerHTML = `
      <div class="panel panel-default">
        <div class="panel-heading">
          <h5 style="margin:0;">Selecionar Regras para Visualizar Auditor</h5>
          <small>Clique nas regras para adicionar/remover do gráfico</small>
        </div>
        <div class="panel-body">
          <div class="regra-selector-auditor" style="display:flex; flex-wrap:wrap; gap:8px;">
            ${Object.keys(regraData).map(regra => {
              const titulo = titulosRegras[regra] || `Regra ${regra}`;
              return `
                <button class="btn btn-default regra-btn-auditor" 
                        data-regra="${regra}" 
                        data-titulo="${titulo}"
                        title="${titulo}"
                        style="margin:2px; min-width:60px;">
                  ID: ${regra}
                </button>
              `;
            }).join('')}
          </div>
        </div>
      </div>
    `;
    
    container.appendChild(selectorDiv);

    // Criar container para o gráfico único
    const chartContainerDiv = document.createElement('div');
    chartContainerDiv.className = 'col-sm-12';
    chartContainerDiv.innerHTML = `
      <div class="panel panel-default">
        <div class="panel-heading">
          <h5 style="margin:0;">Auditor por Regra e Status</h5>
          <small>Selecione as regras acima para visualizar</small>
        </div>
        <div class="panel-body">
          <div class="chart-container" style="position:relative; height:400px;">
            <canvas id="db_auditor_regras_chart"></canvas>
          </div>
        </div>
      </div>
    `;
    
    container.appendChild(chartContainerDiv);

    // Armazenar dados para uso posterior
    this._auditorRegraData = {
      regraData: regraData,
      titulosRegras: titulosRegras
    };

    // Adicionar event listeners aos botões
    setTimeout(() => {
      this._bindAuditorRegraButtons();
    }, 100);


  } catch(e) {
    console.error("Erro ao carregar gráfico auditor por regra:", e);
    console.error("Stack trace:", e.stack);
  }
},
// === NOVA: restaura a aba ativa após reload, mesmo com ACL/menus habilitados depois ===
restaurarAbaPosReload: function () {
  var KEY = 'audit_active_tab';
  var alvo = sessionStorage.getItem(KEY);
  if (!alvo || !/^#[\w\-]+$/.test(alvo)) return; // nada para restaurar

  // tenta ativar a aba (Bootstrap/Fluig) com fallback em .click()
  var tentarAtivar = function () {
    try {
      var $link = $('.nav-tabs a[href="' + alvo + '"], .nav a[href="' + alvo + '"]');
      if (!$link.length) return false;

      // se a aba estiver desabilitada/oculta ainda não ativa
      var $li = $link.closest('li');
      var disabled = $li.hasClass('disabled') || $link.is('[aria-disabled="true"]');
      var invisivel = !$link.is(':visible');
      if (disabled || invisivel) return false;

      // ativa pelo método do bootstrap (se existir) e também dispara click
      try { $link.tab && $link.tab('show'); } catch (_) {}
      try { $link[0].click(); } catch (_) {}

      // remove o foco preso, se houver
      try { if (document.activeElement) document.activeElement.blur(); } catch (_){}

      // limpamos a intenção para não reexecutar depois
      sessionStorage.removeItem(KEY);
      return true;
    } catch (e) {
      // em qualquer erro, não repetir indefinidamente
      sessionStorage.removeItem(KEY);
      return true;
    }
  };

  // 1) tenta já de cara
  if (tentarAtivar()) return;

  // 2) espera a navbar habilitar (ACL) por até ~8s
  var tentativas = 0;
  var iv = setInterval(function () {
    tentativas++;
    if (tentarAtivar() || tentativas > 80) { // 80 * 100ms = 8s
      clearInterval(iv);
      if (tentativas > 80) sessionStorage.removeItem(KEY); // não deixa sujeira
    }
  }, 100);
}

});
