import { getAllPosts } from "@/lib/mdx";

export const metadata = {
  title: "Engineering Blog | OsVault",
  description: "Deep technical dives into software supply chain security, reachability analysis, and our zero-trust engineering practices.",
};

export default function BlogIndex() {
  const posts = getAllPosts();
  
  if (!posts.length) {
    return (
      <main className="blog-index">
        <div className="container">
          <div style={{ textAlign: "center", padding: "120px 0" }}>
            <h1 className="hero-h1">Engineering Blog</h1>
            <p className="hero-sub">Coming soon.</p>
          </div>
        </div>
      </main>
    );
  }

  const [featuredPost, ...recentPosts] = posts;

  return (
    <main className="blog-index">
      {/* ── Header ── */}
      <section className="blog-header">
        <div className="container">
          <div className="blog-title-wrap">
            <h1 className="blog-title">Engineering Blog</h1>
            <p className="blog-subtitle">
              Deep dives into supply chain security, Rust ingestion engines, and eliminating false positives.
            </p>
          </div>
        </div>
      </section>

      {/* ── Featured Post ── */}
      <section className="blog-featured">
        <div className="container" style={{ position: "relative", zIndex: 2 }}>
          <h2 className="blog-section-title">Featured</h2>
          <a href={`/blog/${featuredPost.slug}`} className="blog-featured-card">
            <div className="blog-featured-content">
              <div className="blog-meta">
                <span className="blog-date">{new Date(featuredPost.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric'})}</span>
                <span className="blog-dot" />
                <span className="blog-author">{featuredPost.author}</span>
              </div>
              <h3 className="blog-featured-title">{featuredPost.title}</h3>
              <p className="blog-featured-excerpt">{featuredPost.excerpt}</p>
              <div className="blog-tags">
                {featuredPost.tags?.map((tag) => (
                  <span key={tag} className="blog-tag">{tag}</span>
                ))}
              </div>
            </div>
            {featuredPost.coverImage && (
              <div className="blog-featured-image-wrap">
                {/* Fallback pattern for now since we don't have images configured */}
                <div className="blog-featured-image-placeholder" style={{
                  backgroundImage: `url(${featuredPost.coverImage})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  width: '100%',
                  height: '100%',
                  minHeight: '280px'
                }} />
              </div>
            )}
          </a>
        </div>
      </section>

      {/* ── Recent Posts ── */}
      {recentPosts.length > 0 && (
        <section className="blog-recent">
          <div className="container">
            <h2 className="blog-section-title">Recent Updates</h2>
            <div className="blog-grid">
              {recentPosts.map((post) => (
                <a key={post.slug} href={`/blog/${post.slug}`} className="blog-card">
                  <div className="blog-meta">
                    <span className="blog-date">{new Date(post.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric'})}</span>
                  </div>
                  <h3 className="blog-card-title">{post.title}</h3>
                  <p className="blog-card-excerpt">{post.excerpt}</p>
                  <div className="blog-tags">
                    {post.tags?.map((tag) => (
                      <span key={tag} className="blog-tag">{tag}</span>
                    ))}
                  </div>
                </a>
              ))}
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
