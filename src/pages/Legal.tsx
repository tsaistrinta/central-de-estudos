import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import ChipLogo from '@/components/ChipLogo'

type Props = { titulo: string }

const CONTATO = 'lucas.strinta@aluno.cps.sp.gov.br'
const VIGENCIA = '19 de novembro de 2026'

function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-[17px] font-semibold tracking-tight text-foreground">{titulo}</h2>
      <div className="mt-2 space-y-2.5 text-[14px] leading-relaxed text-muted-foreground [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-1">{children}</div>
    </section>
  )
}

function Termos() {
  return (
    <>
      <Secao titulo="1. O que é a Central de Estudos">
        <p>
          A Central de Estudos é uma plataforma acadêmica desenvolvida como Projeto de Trabalho de Graduação (PTG) do curso de
          Análise e Desenvolvimento de Sistemas da Fatec Indaiatuba – Dr. Archimedes Lammoglia, por Lucas Tsai. Ela reúne agenda,
          horários, materiais, avisos e conversas da turma. Não é um serviço oficial do Centro Paula Souza nem da Fatec.
        </p>
      </Secao>
      <Secao titulo="2. Quem pode usar">
        <p>
          Alunos e professores com e-mail institucional da unidade. Cada pessoa usa a própria conta e cuida da própria senha.
          A Central nunca pede nem guarda a senha do SIGA.
        </p>
      </Secao>
      <Secao titulo="3. Informações do Archie">
        <p>
          O Archie, a IA da plataforma, lê páginas públicas do site da Fatec e monta datas, horários e avisos. Ele só publica
          sozinho o que leu igual por dois caminhos independentes, e toda informação mostra o link da fonte. Mesmo assim, a fonte
          oficial é sempre o documento da Fatec: confira pelo link em caso de dúvida. Datas que você editou não são trocadas sem a
          sua confirmação.
        </p>
      </Secao>
      <Secao titulo="4. Turmas, conversa e acervo">
        <ul>
          <li>Você só entra numa turma com o código dado pelo professor ou com a aprovação do professor ou do administrador.</li>
          <li>O que você publica numa turma (mensagens, dúvidas, respostas, votos e reações) é visto pelos colegas dela.</li>
          <li>
            Itens enviados ao acervo da disciplina ficam disponíveis para quem cursa ou já cursou a disciplina, inclusive em
            semestres futuros. Todo envio é verificado pelo Archie antes de aparecer.
          </li>
          <li>Só envie material que você tem o direito de compartilhar e que não tenha dados pessoais de outras pessoas.</li>
        </ul>
      </Secao>
      <Secao titulo="5. O que não é permitido">
        <ul>
          <li>Conteúdo ilícito, ofensivo, discriminatório, sexual, violento ou que exponha dados pessoais de terceiros.</li>
          <li>Arquivos com vírus, macros ou qualquer código malicioso; links para golpes.</li>
          <li>Material protegido por direito autoral sem autorização; respostas de provas em andamento.</li>
          <li>Tentar acessar dados de outras pessoas, burlar códigos de turma ou atrapalhar o funcionamento da plataforma.</li>
        </ul>
        <p>
          Conteúdo que fere estas regras vai para a quarentena e pode ser removido; três denúncias tiram um item do ar até a
          revisão. Contas que insistem podem ser suspensas.
        </p>
      </Secao>
      <Secao titulo="6. Seus direitos sobre o que você cria">
        <p>
          Seus materiais continuam seus. Ao publicar numa turma ou no acervo, você autoriza que colegas vejam e baixem o conteúdo
          para estudo, dentro da plataforma.
        </p>
      </Secao>
      <Secao titulo="7. Disponibilidade">
        <p>
          Por ser um projeto acadêmico em fase piloto, a plataforma pode passar por mudanças e interrupções. Mantenha cópias do que
          for importante; você pode baixar todos os seus dados em Configurações → Privacidade e dados.
        </p>
      </Secao>
      <Secao titulo="8. Contato e mudanças">
        <p>
          Dúvidas, denúncias e pedidos: <a className="text-primary hover:underline" href={`mailto:${CONTATO}`}>{CONTATO}</a>. Quando estes
          termos mudarem, a data abaixo é atualizada e as mudanças importantes são avisadas na plataforma.
        </p>
      </Secao>
    </>
  )
}

function Privacidade() {
  return (
    <>
      <Secao titulo="1. Quem cuida dos seus dados">
        <p>
          Controlador: Lucas Tsai, autor do projeto Central de Estudos (PTG de ADS, Fatec Indaiatuba). Contato para qualquer
          assunto de privacidade (encarregado): <a className="text-primary hover:underline" href={`mailto:${CONTATO}`}>{CONTATO}</a>.
        </p>
      </Secao>
      <Secao titulo="2. Que dados coletamos">
        <ul>
          <li>Cadastro: nome, e-mail institucional, curso, semestre, turno e papel (aluno, professor…).</li>
          <li>O que você cria: eventos da agenda, arquivos e anotações, tarefas, itens de revisão, notas e faltas que você registra.</li>
          <li>O que você publica nas turmas: mensagens, dúvidas, respostas, votos, reações e itens do acervo.</li>
          <li>Registros técnicos: data de acesso, tentativas de código de turma e registros de segurança e moderação.</li>
        </ul>
        <p>Não coletamos senha do SIGA, documentos pessoais, localização nem dados de pagamento.</p>
      </Secao>
      <Secao titulo="3. Para que usamos">
        <ul>
          <li>Montar sua agenda, horários e avisos e organizar seus materiais (execução do serviço que você pediu).</li>
          <li>Permitir a colaboração da turma e manter o acervo da disciplina.</li>
          <li>Proteger a plataforma: moderação do acervo, limite de tentativas, auditoria de ações administrativas.</li>
          <li>Avaliar o piloto no PTG com estatísticas agregadas, sem identificar ninguém.</li>
        </ul>
        <p>Bases legais (LGPD, art. 7º): consentimento, execução do serviço e legítimo interesse em manter a plataforma segura.</p>
      </Secao>
      <Secao titulo="4. O Archie e a IA">
        <p>
          O Archie lê apenas páginas públicas do site da Fatec, respeitando o robots.txt. O modelo de IA roda num servidor próprio do
          projeto: nenhum dado seu é enviado a serviços de IA de terceiros. Os arquivos que você envia ao acervo são verificados
          por ele para barrar conteúdo impróprio e dados pessoais de terceiros.
        </p>
      </Secao>
      <Secao titulo="5. Com quem compartilhamos">
        <p>
          Seus dados não são vendidos nem cedidos. Ficam guardados em provedores que operam a infraestrutura em nome do projeto:
          Supabase (banco de dados, login e arquivos) e Cloudflare (hospedagem do site). Seus colegas de turma veem apenas o que você
          publica na turma e seu nome; seu e-mail não aparece para eles.
        </p>
      </Secao>
      <Secao titulo="6. Por quanto tempo">
        <p>
          Enquanto sua conta existir. Se você excluir a conta, os dados pessoais são apagados na hora; o que você publicou para a turma
          continua lá sem o seu nome, como “Ex-aluno”. Registros de segurança sem dados pessoais podem ficar para auditoria.
        </p>
      </Secao>
      <Secao titulo="7. Seus direitos (LGPD, art. 18)">
        <ul>
          <li>Ver e baixar todos os seus dados: Configurações → Privacidade e dados → Baixar todos os meus dados.</li>
          <li>Corrigir seus dados: Configurações → Perfil.</li>
          <li>Excluir a conta: Configurações → Privacidade e dados → Excluir minha conta.</li>
          <li>Revogar o consentimento, pedir informações sobre o uso ou reclamar: escreva para {CONTATO}. Você também pode procurar a ANPD.</li>
        </ul>
      </Secao>
      <Secao titulo="8. Segurança">
        <p>
          Acesso só com e-mail institucional e código de verificação, conexão criptografada, regras de acesso no banco que separam o
          que é seu, da sua turma e da unidade, e testes automáticos de segurança a cada mudança no código.
        </p>
      </Secao>
    </>
  )
}

// Termos de uso e Política de privacidade (LGPD). Contato do controlador: e-mail institucional do autor.
export default function Legal({ titulo }: Props) {
  const termos = /termos/i.test(titulo)
  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <Link to="/" className="flex items-center gap-2">
        <ChipLogo />
        <span className="font-semibold">Central de Estudos</span>
      </Link>
      <h1 className="mt-10 text-[28px] font-semibold tracking-tight">{titulo}</h1>
      <p className="mt-2 text-sm text-muted-foreground">Vigente desde {VIGENCIA}.</p>
      {termos ? <Termos /> : <Privacidade />}
      <p className="mt-10 border-t border-border pt-4 text-sm text-muted-foreground">
        Veja também: {termos ? <Link to="/privacidade" className="text-primary hover:underline">Política de privacidade</Link> : <Link to="/termos" className="text-primary hover:underline">Termos de uso</Link>}
      </p>
    </div>
  )
}
