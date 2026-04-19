import { getPostBySlug, getAllPosts } from "@/lib/mdx";
import { MDXRemote } from "next-mdx-remote/rsc";
import remarkGfm from "remark-gfm";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = await params;
  const { meta } = getPostBySlug(resolvedParams.slug);
  return {
    title: `${meta.title} | OsVault Blog`,
    description: meta.excerpt,
    openGraph: {
      title: meta.title,
      description: meta.excerpt,
      type: "article",
      publishedTime: meta.date,
      authors: [meta.author],
    },
    twitter: {
      card: "summary_large_image",
      title: meta.title,
      description: meta.excerpt,
    },
  };
}

export async function generateStaticParams() {
  const posts = getAllPosts();
  return posts.map((post) => ({
    slug: post.slug,
  }));
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = await params;
  const { meta, content } = getPostBySlug(resolvedParams.slug);

  return (
    <main className="blog-post-page">
      {/* Article Header */}
      <header className="blog-post-header">
        <div className="blog-post-header-glow" aria-hidden="true" />
        <div className="container blog-post-container">
          <div className="blog-post-meta-top">
            <a href="/blog" className="blog-back-link">← Back to Blog</a>
            <span className="blog-date">
              {new Date(meta.date).toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </span>
          </div>
          
          <h1 className="blog-post-h1">{meta.title}</h1>
          <p className="blog-post-excerpt">{meta.excerpt}</p>
          
          <div className="blog-post-author-block">
            <div className="blog-post-author-avatar">
              {meta.author.charAt(0)}
            </div>
            <div>
              <div className="blog-post-author-name">{meta.author}</div>
              <div className="blog-post-author-role">{meta.authorRole}</div>
            </div>
          </div>
        </div>
      </header>

      {/* Article Content */}
      <article className="blog-post-content">
        <div className="container blog-post-container">
          <div className="prose">
            <MDXRemote 
              source={content} 
              options={{
                mdxOptions: {
                  remarkPlugins: [remarkGfm],
                }
              }}
            />
          </div>
        </div>
      </article>

      {/* Bottom CTA */}
      <section className="blog-post-cta">
        <div className="container blog-post-container">
          <div className="blog-post-cta-inner">
            <div className="blog-post-cta-content">
              <h3>Stop chasing false positives.</h3>
              <p>OsVault analyzes your AST directly within GitHub PRs to determine if vulnerabilities are actually reachable.</p>
            </div>
            <a href="https://github.com/apps/osvault-security" className="btn-primary" target="_blank" rel="noopener noreferrer">
              Install GitHub App <span className="btn-arrow">→</span>
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
