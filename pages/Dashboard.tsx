import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, MoreHorizontal, Film } from 'lucide-react';
import { mockBackend } from '../services/mockBackend';
import { Project } from '../types';
import { StatusBadge } from '../components/StatusBadge';

export const Dashboard: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProjects = async () => {
      const data = await mockBackend.getProjects();
      setProjects(data);
      setLoading(false);
    };
    fetchProjects();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-slate-400">Manage your viral video campaigns.</p>
        </div>
        <Link 
          to="/new" 
          className="inline-flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-500 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-lg shadow-brand-900/20"
        >
          <Plus size={18} />
          New Project
        </Link>
      </div>

      {/* Filters/Search Mockup */}
      <div className="flex items-center gap-3 bg-slate-900 p-2 rounded-lg border border-slate-800 w-full max-w-md">
        <Search size={18} className="text-slate-500 ml-2" />
        <input 
          type="text" 
          placeholder="Search projects..." 
          className="bg-transparent border-none focus:outline-none text-slate-200 placeholder-slate-500 w-full"
        />
      </div>

      {loading ? (
        <div className="text-center py-20 text-slate-500">Loading projects...</div>
      ) : projects.length === 0 ? (
        <div className="text-center py-20 border-2 border-dashed border-slate-800 rounded-xl bg-slate-900/50">
          <Film className="mx-auto text-slate-600 mb-4" size={48} />
          <h3 className="text-lg font-medium text-slate-300">No projects yet</h3>
          <p className="text-slate-500 mb-6">Create your first viral video concept today.</p>
          <Link to="/new" className="text-brand-500 hover:underline">Get Started</Link>
        </div>
      ) : (
        <div className="grid gap-4">
          {projects.map((project) => (
            <Link 
              key={project.id} 
              to={`/project/${project.id}`}
              className="block group"
            >
              <div className="bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 rounded-xl p-5 transition-all duration-200 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-slate-800 flex items-center justify-center group-hover:bg-slate-700 transition-colors">
                    <Film size={20} className="text-slate-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-100 group-hover:text-white transition-colors">{project.title}</h3>
                    <div className="flex items-center gap-3 text-sm text-slate-500 mt-1">
                      <span>{project.topic}</span>
                      <span className="w-1 h-1 rounded-full bg-slate-700"></span>
                      <span>{new Date(project.updatedAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-6">
                  <div className="flex gap-1">
                    {project.platforms.map(p => (
                       <span key={p} className="text-xs bg-slate-800 text-slate-400 px-2 py-1 rounded border border-slate-700">{p}</span>
                    ))}
                  </div>
                  <StatusBadge status={project.status} />
                  <MoreHorizontal size={20} className="text-slate-600 group-hover:text-slate-400" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};