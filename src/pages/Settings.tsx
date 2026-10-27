import { useEffect, useRef, useState } from 'react';
import Layout from '../components/Layout';
import { useConfirm } from '../components/ConfirmDialog';
import { useToast } from '../components/Toast';
import { requestPersistence, storageInfo } from '../database/db';
import { exportBackup, importBackup } from '../services/backup';
import { downloadBlob } from '../services/share';
import { friendlyError } from '../utils/errors';

const mb = (n?: number) => (n === undefined ? '-' : `${(n / 1024 / 1024).toFixed(1)} MB`);

export default function Settings() {
  const [info, setInfo] = useState<{ usage?: number; quota?: number; persisted?: boolean }>({});
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { confirm, dialog } = useConfirm();

  const refresh = () => storageInfo().then(setInfo).catch(() => undefined);
  useEffect(() => {
    void refresh();
  }, []);

  const doExport = async () => {
    setBusy(true);
    try {
      const { blob, fileName } = await exportBackup();
      downloadBlob(blob, fileName);
      toast('Backup gerado');
    } catch (e) {
      toast(friendlyError(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  const doImport = async (f: File) => {
    const ok = await confirm({
      title: 'Restaurar backup?',
      message: 'Veículos, vistorias e fotografias do arquivo serão adicionados. Registros com o mesmo identificador serão sobrescritos.',
      confirmLabel: 'Restaurar',
    });
    if (!ok) return;
    setBusy(true);
    try {
      const r = await importBackup(f);
      toast(`Restaurado: ${r.vehicles} veículo(s), ${r.inspections} vistoria(s), ${r.photos} foto(s)`);
      await refresh();
    } catch (e) {
      toast(friendlyError(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Layout title="Ajustes" back="/">
      <section className="card">
        <h2>Backup dos dados</h2>
        <p className="muted">Os dados ficam somente neste aparelho e neste navegador. Faça backup com frequência e antes de trocar de celular.</p>
        <button className="btn btn-primary" disabled={busy} onClick={doExport}>Exportar backup (com fotos)</button>
        <button className="btn" disabled={busy} onClick={() => file.current?.click()}>Importar backup</button>
        <input ref={file} type="file" accept="application/json,.json" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void doImport(f); }} />
      </section>

      <section className="card">
        <h2>Armazenamento</h2>
        <div>Usado: {mb(info.usage)} de {mb(info.quota)}</div>
        <div>Proteção contra limpeza automática: {info.persisted === undefined ? 'indisponível' : info.persisted ? 'ativa' : 'inativa'}</div>
        {!info.persisted && (
          <button className="btn btn-small" onClick={async () => { toast((await requestPersistence()) ? 'Proteção ativada' : 'O navegador não concedeu a proteção'); await refresh(); }}>
            Proteger dados
          </button>
        )}
      </section>

      <section className="card">
        <h2>Instalar no celular</h2>
        <p><b>Android (Chrome):</b> abra o menu ⋮ e toque em “Instalar app” ou “Adicionar à tela inicial”.</p>
        <p><b>iPhone (Safari):</b> toque em Compartilhar e depois em “Adicionar à Tela de Início”. Use o Safari, pois outros navegadores no iPhone não instalam o app.</p>
      </section>

      <section className="card">
        <h2>Logomarca no relatório</h2>
        <p className="muted">A logomarca do relatório fica no arquivo <b>public/logo.png</b> do projeto. Para trocá-la, substitua o arquivo e publique novamente.</p>
      </section>
      {dialog}
    </Layout>
  );
}
