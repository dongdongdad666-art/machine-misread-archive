import { Link } from "react-router-dom";
import { seedArchives } from "../data/seed-archives";
import { ArtifactViewer } from "../features/archive/ArtifactViewer";

const representative = seedArchives[2];

export function CaseStudyPage() {
  return (
    <article className="page case-study">
      <header className="case-hero">
        <div>
          <p className="section-label">CASE 01 / AIGC 视觉与产品系统</p>
          <h1>机器误读档案馆</h1>
          <p>把旧物识别里的不确定性，变成可追溯、可交互、可治理的生成档案。</p>
        </div>
        <div className="case-hero-artifact"><ArtifactViewer item={representative} /></div>
      </header>

      <aside className="prototype-proof" data-evidence="live-prototype">
        <div><strong>先看运行中的产品</strong><span>上传 → 机器阅读 → 人的补述 → 语义差 → 生成 → 审核</span></div>
        <Link className="primary-action" to="/create">体验可运行原型</Link>
      </aside>

      <section className="case-section case-section--split">
        <h2>问题</h2>
        <div><p className="case-lead">旧物数字化常停在“拍照 + 标签”，而真正决定它为何值得保存的生活语境，会在结构化过程中再次消失。</p><p>现成识别系统擅长回答“这是什么”，却不负责说明“它对谁意味着什么”，也很少公开自己的不确定与误读。</p></div>
      </section>

      <section className="case-section case-section--statement">
        <h2>假设</h2>
        <blockquote>如果不纠正机器，而是把机器判断与人的记忆并置，二者的差距本身就能成为新的视觉材料。</blockquote>
      </section>

      <section className="case-section case-section--scope">
        <h2>范围</h2>
        <div className="scope-boundary">
          <p><strong>这次做什么</strong>完整的公众投稿、生成、归档与治理闭环；12 件可核验的种子档案；确定性视觉引擎。</p>
          <p><strong>这次不声称什么</strong>不把生成图当作真实物件证据；不伪造用户访谈、模型复跑日期或业务增长指标。</p>
        </div>
      </section>

      <section className="case-section case-section--objects">
        <div className="case-section-heading"><h2>真实物件</h2><p>3 件用户提供实拍，9 件许可档案影像。原图、作者、许可和派生处理逐件留痕。</p></div>
        <div className="object-contact-sheet" aria-label="种子档案实物样本">
          <figure className="object-sample object-sample--large"><img src="/seed-media/audio-cassette-source.webp" alt="透明外壳的录音磁带" width="640" height="480" loading="lazy" decoding="async" /><figcaption>MMA-OBJ-0004 / 许可档案</figcaption></figure>
          <figure className="object-sample"><img src="/seed-media/numeric-pager-source.webp" alt="黑色数字寻呼机" width="1280" height="954" loading="lazy" decoding="async" /><figcaption>MMA-OBJ-0007 / 许可档案</figcaption></figure>
          <figure className="object-sample"><img src="/seed-media/slide-rule-source.webp" alt="带保护套的计算尺" width="1100" height="825" loading="lazy" decoding="async" /><figcaption>MMA-OBJ-0009 / 许可档案</figcaption></figure>
        </div>
        <p className="mockup-disclaimer">辅助呈现，不作为功能证据</p>
      </section>

      <section className="case-section case-section--tension">
        <h2>机器与人的张力</h2>
        <div className="tension-ledger">
          <div><span>机器说</span><strong>“修补过的旧书”</strong><p>依据封面、文字、材料和可见损伤形成可核验描述。</p></div>
          <div><span>人的记录</span><strong>“尚未讲述属于谁”</strong><p>不自动补成怀旧故事，让缺失本身保留在档案里。</p></div>
          <div><span>语义差</span><strong>62%</strong><p>把两种解释的距离映射为图层偏移、碎裂与文字碰撞。</p></div>
        </div>
      </section>

      <section className="case-section case-section--flow">
        <h2>交互流程</h2>
        <ol className="case-flow">
          <li><span>01</span><strong>提交证据</strong><p>照片、来源与公开许可分开确认。</p></li>
          <li><span>02</span><strong>机器先读</strong><p>输出标签、描述、材料、文字与不确定项。</p></li>
          <li><span>03</span><strong>人再补述</strong><p>关系、记忆与情绪不被模型代写。</p></li>
          <li><span>04</span><strong>生成残差</strong><p>参数与随机种子可复现同一结果。</p></li>
          <li><span>05</span><strong>审核发布</strong><p>来源证据和撤回链路优先于视觉效果。</p></li>
        </ol>
      </section>

      <section className="case-section case-section--rules">
        <h2>生成规则</h2>
        <div className="rule-equation"><code>机器标签 × 人的记忆 × 语义差 × 固定种子</code><span>→</span><strong>可复现的语义残差</strong></div>
        <p>语义差不直接生成“更漂亮”的图，而是控制图层错位、碎裂程度、运动速度、色温、线密度与文本碰撞六个参数。相同输入和种子必须得到相同作品。</p>
      </section>

      <section className="case-section case-section--architecture">
        <h2>技术架构</h2>
        <div className="architecture-line" aria-label="系统架构">
          <span>React 交互界面</span><i>→</i><span>Serverless API</span><i>→</i><span>视觉模型适配层</span><i>→</i><span>确定性 SVG 引擎</span><i>→</i><span>审核与公共档案</span>
        </div>
        <p>模型回答结构化观察；视觉作品由浏览器端规则引擎绘制。两者解耦，使演示在没有 GPU 推理时仍可验证、复现和部署。</p>
      </section>

      <section className="case-section case-section--governance">
        <h2>治理机制</h2>
        <div className="governance-principles"><p><strong>来源先于作品</strong>每件档案保留提交者或许可页、拍摄日期与处理说明。</p><p><strong>原图与作品分权</strong>允许原图私密而生成作品公开。</p><p><strong>发布不是终点</strong>撤回、驳回、历史记录和策展集合都进入产品流程。</p></div>
        <Link className="text-action" to="/governance">打开治理台演示</Link>
      </section>

      <section className="case-section case-section--failures">
        <div className="case-section-heading"><h2>失败与边界</h2><p>失败样本不是脚注，而是系统可信度的一部分。</p></div>
        <div className="failure-strip">
          <article><span>MMA-OBJ-0007</span><h3>黑屏寻呼机</h3><p>功能判断高度依赖外形先验，可能被误读为遥控器或录音设备。</p></article>
          <article><span>MMA-OBJ-0009</span><h3>计算尺</h3><p>密集刻度可被识别，计算用途却容易被压扁成“普通直尺”。</p></article>
          <article><span>MMA-OBJ-0011</span><h3>胶卷盒</h3><p>容器脱离胶片语境后，外观与药瓶等日用品发生类别碰撞。</p></article>
        </div>
      </section>

      <section className="case-section case-section--limitations">
        <h2>限制</h2>
        <ul><li>目前 9 件公共许可影像没有原持有者口述，因此明确标为“等待补述”。</li><li>种子档案中的机器标签是策展夹具，不冒充真实模型三次复跑；上线后才记录真实运行日期与稳定度。</li><li>语义差目前由可解释规则映射，不代表心理学量表或统计结论。</li><li>当前没有真实用户规模与商业增长数据，案例只展示系统能力与验证路径。</li></ul>
      </section>

      <section className="case-section case-section--extensions">
        <h2>商业延展</h2>
        <div><p><strong>品牌文化资产</strong>把员工、用户与产品旧物转成可追溯的品牌档案和展览内容。</p><p><strong>博物馆公众共创</strong>承接征集、机器辅助编目、策展筛选与线上互动展。</p><p><strong>城市记忆计划</strong>围绕迁移、媒介与制度更替形成可持续采集的社区档案基础设施。</p></div>
        <Link className="primary-action" to="/archive">查看 12 件公共档案</Link>
      </section>
    </article>
  );
}
