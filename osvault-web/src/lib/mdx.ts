import fs from "fs";
import path from "path";
import matter from "gray-matter";

const postsDirectory = path.join(process.cwd(), "_posts");

export interface BlogPostMeta {
  slug: string;
  title: string;
  date: string;
  author: string;
  authorRole: string;
  excerpt: string;
  coverImage?: string;
  tags?: string[];
}

export interface BlogPost {
  meta: BlogPostMeta;
  content: string;
}

/**
 * Ensures the _posts directory exists
 */
function ensurePostsDir() {
  if (!fs.existsSync(postsDirectory)) {
    fs.mkdirSync(postsDirectory, { recursive: true });
  }
}

/**
 * Retrieves a single post by its slug (filename without .mdx)
 */
export function getPostBySlug(slug: string): BlogPost {
  ensurePostsDir();
  const realSlug = slug.replace(/\.mdx$/, "");
  const fullPath = path.join(postsDirectory, `${realSlug}.mdx`);
  const fileContents = fs.readFileSync(fullPath, "utf8");

  const { data, content } = matter(fileContents);

  return {
    meta: {
      slug: realSlug,
      title: data.title || "Untitled",
      date: data.date || "1970-01-01",
      author: data.author || "OsVault Team",
      authorRole: data.authorRole || "",
      excerpt: data.excerpt || "",
      coverImage: data.coverImage,
      tags: data.tags || [],
    },
    content,
  };
}

/**
 * Retrieves all posts, sorted by date descending.
 */
export function getAllPosts(): BlogPostMeta[] {
  ensurePostsDir();
  const files = fs.readdirSync(postsDirectory);
  
  const posts = files
    .filter((file) => file.endsWith(".mdx"))
    .map((file) => {
      const { meta } = getPostBySlug(file);
      return meta;
    })
    .sort((a, b) => (new Date(b.date).getTime() - new Date(a.date).getTime()));
    
  return posts;
}
