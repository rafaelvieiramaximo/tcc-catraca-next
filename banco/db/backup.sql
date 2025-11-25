--
-- PostgreSQL database dump
--

\restrict 9EK5YaFgWVvBhkhtEEkrgQ94eONgafhJdGsC1sP0XEXFRYJshmCkHxNSj62288i

-- Dumped from database version 15.14 (Debian 15.14-1.pgdg13+1)
-- Dumped by pg_dump version 15.14 (Debian 15.14-1.pgdg13+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: auto_determinar_controle(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.auto_determinar_controle() RETURNS trigger
    LANGUAGE plpgsql
    AS $$

DECLARE

    v_ultimo_controle BOOLEAN;

BEGIN

    -- Só executa se controle não for especificado

    IF NEW.controle IS NULL THEN

        -- Busca o último registro de controle do usuário

        SELECT controle INTO v_ultimo_controle

        FROM log_entrada

        WHERE usuario_id = NEW.usuario_id

        ORDER BY created_at DESC

        LIMIT 1;

        

        -- Lógica: Se último foi SAÍDA (true) ou não há registro, então é ENTRADA (false)

        -- Se último foi ENTRADA (false), então é SAÍDA (true)

        IF v_ultimo_controle IS NULL OR v_ultimo_controle = TRUE THEN

            NEW.controle := FALSE; -- ENTRADA

        ELSE

            NEW.controle := TRUE;  -- SAÍDA

        END IF;

    END IF;

    

    RETURN NEW;

END;

$$;


ALTER FUNCTION public.auto_determinar_controle() OWNER TO postgres;

--
-- Name: notify_new_entry(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.notify_new_entry() RETURNS trigger
    LANGUAGE plpgsql
    AS $$

BEGIN

    -- Atualizar o contador de mudanças para log_entrada

    UPDATE system_changes 

    SET last_change = NOW(), 

        change_count = change_count + 1 

    WHERE table_name = 'log_entrada';

    RETURN NEW;

END;

$$;


ALTER FUNCTION public.notify_new_entry() OWNER TO postgres;

--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_updated_at_column() OWNER TO postgres;

--
-- Name: validar_identificador(character varying); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.validar_identificador(identificador character varying) RETURNS boolean
    LANGUAGE plpgsql
    AS $$

BEGIN

    RETURN EXISTS (

        SELECT 1 FROM funcionario WHERE matricula = identificador

        UNION ALL  

        SELECT 1 FROM estudante WHERE ra = identificador

    );

END;

$$;


ALTER FUNCTION public.validar_identificador(identificador character varying) OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: admin; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.admin (
    id integer NOT NULL,
    usuario_id integer NOT NULL,
    id_admin integer NOT NULL,
    senha text NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.admin OWNER TO postgres;

--
-- Name: admin_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.admin_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.admin_id_seq OWNER TO postgres;

--
-- Name: admin_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.admin_id_seq OWNED BY public.admin.id;


--
-- Name: log; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.log (
    id_log integer NOT NULL,
    id_usuario bigint NOT NULL,
    data_hora timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    acao character varying(255) NOT NULL,
    status character varying(100) NOT NULL,
    detalhes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    data_acao timestamp without time zone DEFAULT CURRENT_DATE NOT NULL,
    identificador character varying(50),
    nome_usuario character varying(255)
);


ALTER TABLE public.log OWNER TO postgres;

--
-- Name: log_entrada; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.log_entrada (
    id integer NOT NULL,
    usuario_id integer NOT NULL,
    nome character varying(255) NOT NULL,
    tipo character varying(50) NOT NULL,
    periodo character varying(20),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    controle boolean,
    horario time without time zone DEFAULT CURRENT_TIME NOT NULL,
    data_entrada date DEFAULT CURRENT_DATE NOT NULL,
    identificador bigint,
    updated_at timestamp without time zone DEFAULT now(),
    CONSTRAINT log_entrada_periodo_check CHECK (((periodo)::text = ANY ((ARRAY['MANHA'::character varying, 'TARDE'::character varying, 'NOITE'::character varying])::text[]))),
    CONSTRAINT log_entrada_tipo_check CHECK (((tipo)::text = ANY ((ARRAY['ESTUDANTE'::character varying, 'FUNCIONARIO'::character varying, 'ADMIN'::character varying, 'PORTARIA'::character varying, 'RH'::character varying, 'VISITANTE'::character varying])::text[])))
);


ALTER TABLE public.log_entrada OWNER TO postgres;

--
-- Name: log_entrada_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.log_entrada_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.log_entrada_id_seq OWNER TO postgres;

--
-- Name: log_entrada_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.log_entrada_id_seq OWNED BY public.log_entrada.id;


--
-- Name: log_id_log_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.log_id_log_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.log_id_log_seq OWNER TO postgres;

--
-- Name: log_id_log_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.log_id_log_seq OWNED BY public.log.id_log;


--
-- Name: portaria; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.portaria (
    id integer NOT NULL,
    usuario_id integer NOT NULL,
    matricula character varying(20) NOT NULL,
    senha text NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.portaria OWNER TO postgres;

--
-- Name: portaria_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.portaria_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.portaria_id_seq OWNER TO postgres;

--
-- Name: portaria_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.portaria_id_seq OWNED BY public.portaria.id;


--
-- Name: rh; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.rh (
    id integer NOT NULL,
    usuario_id integer NOT NULL,
    matricula character varying(20) NOT NULL,
    senha text NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.rh OWNER TO postgres;

--
-- Name: rh_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.rh_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.rh_id_seq OWNER TO postgres;

--
-- Name: rh_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.rh_id_seq OWNED BY public.rh.id;


--
-- Name: system_changes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.system_changes (
    id integer NOT NULL,
    table_name character varying(50) NOT NULL,
    last_change timestamp without time zone DEFAULT now(),
    change_count integer DEFAULT 0
);


ALTER TABLE public.system_changes OWNER TO postgres;

--
-- Name: system_changes_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.system_changes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.system_changes_id_seq OWNER TO postgres;

--
-- Name: system_changes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.system_changes_id_seq OWNED BY public.system_changes.id;


--
-- Name: user_finger; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_finger (
    user_id integer NOT NULL,
    template_position integer
);


ALTER TABLE public.user_finger OWNER TO postgres;

--
-- Name: usuario; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.usuario (
    id integer NOT NULL,
    nome character varying(255) NOT NULL,
    tipo character varying(50) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    identificador bigint,
    imagem_path character varying(255),
    CONSTRAINT usuario_tipo_check CHECK (((tipo)::text = ANY ((ARRAY['ESTUDANTE'::character varying, 'FUNCIONARIO'::character varying, 'ADMIN'::character varying, 'PORTARIA'::character varying, 'RH'::character varying, 'VISITANTE'::character varying])::text[])))
);


ALTER TABLE public.usuario OWNER TO postgres;

--
-- Name: usuario_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.usuario_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.usuario_id_seq OWNER TO postgres;

--
-- Name: usuario_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.usuario_id_seq OWNED BY public.usuario.id;


--
-- Name: admin id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admin ALTER COLUMN id SET DEFAULT nextval('public.admin_id_seq'::regclass);


--
-- Name: log id_log; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.log ALTER COLUMN id_log SET DEFAULT nextval('public.log_id_log_seq'::regclass);


--
-- Name: log_entrada id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.log_entrada ALTER COLUMN id SET DEFAULT nextval('public.log_entrada_id_seq'::regclass);


--
-- Name: portaria id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.portaria ALTER COLUMN id SET DEFAULT nextval('public.portaria_id_seq'::regclass);


--
-- Name: rh id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rh ALTER COLUMN id SET DEFAULT nextval('public.rh_id_seq'::regclass);


--
-- Name: system_changes id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.system_changes ALTER COLUMN id SET DEFAULT nextval('public.system_changes_id_seq'::regclass);


--
-- Name: usuario id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.usuario ALTER COLUMN id SET DEFAULT nextval('public.usuario_id_seq'::regclass);


--
-- Data for Name: admin; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.admin (id, usuario_id, id_admin, senha, created_at) FROM stdin;
1	1	1000	$2a$06$gcCNv21PvqujyFPV5PKqtuoyyVCLjAMPt04A6.Zspuh52x74BsI6O	2025-08-27 23:09:31.361565
\.


--
-- Data for Name: log; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.log (id_log, id_usuario, data_hora, acao, status, detalhes, created_at, data_acao, identificador, nome_usuario) FROM stdin;
1	19	2025-09-05 20:26:34.076864	ATUALIZAR_USUARIO	SUCESSO	Usuário ID 19 editado	2025-09-05 20:26:34.076864	2025-09-05 00:00:00	\N	\N
2	19	2025-09-05 20:26:38.473984	DELETAR_USUARIO	SUCESSO	Usuário ID 19 deletado	2025-09-05 20:26:38.473984	2025-09-05 00:00:00	\N	\N
4	19	2025-09-09 17:13:37.035459	ATUALIZAR USUARIO	SUCESSO	Usuário ID 19 editado	2025-09-09 17:13:37.035459	2025-09-09 00:00:00	\N	\N
39	30	2025-09-10 15:12:22.197214	CRIAR_USUARIO	SUCESSO	Funcionário Teste cadastrado com Matrícula 56899	2025-09-10 15:12:22.197214	2025-09-10 00:00:00	56899	\N
41	30	2025-09-10 16:05:48.608183	EXCLUSAO_USUARIO	SUCESSO	Usuário "Teste" (tipo=FUNCIONARIO) foi excluído	2025-09-10 16:05:48.608183	2025-09-10 00:00:00	\N	\N
42	31	2025-09-10 16:07:22.083578	EXCLUSAO_USUARIO	SUCESSO	Usuário "Teste" (tipo=FUNCIONARIO) foi excluído	2025-09-10 16:07:22.083578	2025-09-10 00:00:00	\N	\N
43	32	2025-09-10 16:07:39.748538	CRIAR_USUARIO	SUCESSO	Funcionário Teste cadastrado com Matrícula 89752	2025-09-10 16:07:39.748538	2025-09-10 00:00:00	89752	\N
44	32	2025-09-10 16:07:45.940717	ATUALIZAR USUARIO	SUCESSO	Funcionário Teste editado com Matrícula 89752	2025-09-10 16:07:45.940717	2025-09-10 00:00:00	89752	\N
45	32	2025-09-10 16:07:49.439783	EXCLUSAO_USUARIO	SUCESSO	Usuário "Testess" (tipo=FUNCIONARIO) foi excluído	2025-09-10 16:07:49.439783	2025-09-10 00:00:00	\N	\N
46	89612	2025-09-10 16:12:39.871805	CRIAR_USUARIO	SUCESSO	Funcionário Teste cadastrado com Matrícula 89612	2025-09-10 16:12:39.871805	2025-09-10 00:00:00	\N	\N
47	89612	2025-09-10 16:12:48.141305	ATUALIZAR USUARIO	SUCESSO	Funcionário Teste editado com Matrícula 89612	2025-09-10 16:12:48.141305	2025-09-10 00:00:00	\N	\N
48	33	2025-09-10 16:12:51.505044	EXCLUSAO_USUARIO	SUCESSO	Usuário "Testess" (tipo=FUNCIONARIO) foi excluído	2025-09-10 16:12:51.505044	2025-09-10 00:00:00	\N	\N
49	4568712398756	2025-09-10 16:15:36.989329	ATUALIZAR USUARIO	SUCESSO	Estudante Marcao editado com RA 4568712398756	2025-09-10 16:15:36.989329	2025-09-10 00:00:00	\N	\N
50	63251	2025-09-10 16:22:20.049579	CRIAR_USUARIO	SUCESSO	Funcionário Teste1 cadastrado com Matrícula 63251	2025-09-10 16:22:20.049579	2025-09-10 00:00:00	\N	\N
51	63251	2025-09-10 16:22:24.516713	ATUALIZAR USUARIO	SUCESSO	Funcionário Teste1 editado com Matrícula 63251	2025-09-10 16:22:24.516713	2025-09-10 00:00:00	\N	\N
52	34	2025-09-10 16:22:27.897188	EXCLUSAO_USUARIO	SUCESSO	Usuário "Teste1s" (tipo=FUNCIONARIO) foi excluído	2025-09-10 16:22:27.897188	2025-09-10 00:00:00	\N	\N
53	78123	2025-09-10 16:24:38.770752	CRIAR_USUARIO	SUCESSO	Funcionário Luca cadastrado com Matrícula 78123	2025-09-10 16:24:38.770752	2025-09-10 00:00:00	\N	\N
54	78123	2025-09-10 16:24:42.944469	ATUALIZAR USUARIO	SUCESSO	Funcionário Luca editado com Matrícula 78123	2025-09-10 16:24:42.944469	2025-09-10 00:00:00	\N	\N
55	35	2025-09-10 16:34:10.251604	EXCLUSAO_USUARIO	SUCESSO	Usuário Lucass foi excluído	2025-09-10 16:34:10.251604	2025-09-10 00:00:00	\N	\N
56	56986	2025-09-10 16:52:52.959027	CRIAR_USUARIO	SUCESSO	Funcionário Teste cadastrado com Matrícula 56986	2025-09-10 16:52:52.959027	2025-09-10 00:00:00	\N	Teste
57	56986	2025-09-10 16:53:11.757383	ATUALIZAR USUARIO	SUCESSO	Funcionário Teste editado com Matrícula 56986	2025-09-10 16:53:11.757383	2025-09-10 00:00:00	\N	Teste
58	36	2025-09-10 16:53:39.488564	EXCLUSAO_USUARIO	SUCESSO	Usuário Testess foi excluído	2025-09-10 16:53:39.488564	2025-09-10 00:00:00	\N	Testess
59	2	2025-09-11 18:46:49.794587	EXCLUSAO_USUARIO	SUCESSO	Usuário João Silva foi excluído	2025-09-11 18:46:49.794587	2025-09-11 00:00:00	\N	João Silva
60	4	2025-09-11 18:47:49.506742	EXCLUSAO_USUARIO	SUCESSO	Usuário Ana Pereirasss foi excluído	2025-09-11 18:47:49.506742	2025-09-11 00:00:00	\N	Ana Pereirasss
61	39	2025-09-23 19:08:21.428813	EXCLUSAO_USUARIO	SUCESSO	Usuário Caiçara foi excluído	2025-09-23 19:08:21.428813	2025-09-23 00:00:00	\N	Caiçara
62	37	2025-10-13 17:22:36.346891	EXCLUSAO_USUARIO	SUCESSO	Usuário "Lotus" (tipo=FUNCIONARIO) excluído com sucesso	2025-10-13 17:22:36.346891	2025-10-13 00:00:00	45689	Lotus
63	46	2025-10-13 17:26:09.525665	CRIAR_USUARIO	SUCESSO	ESTUDANTE Sla cadastrado com RA 1235689789125	2025-10-13 17:26:09.525665	2025-10-13 00:00:00	1235689789125	Sla
64	46	2025-10-13 17:26:25.143599	ATUALIZAR_USUARIO	ERRO	Falha ao editar usuário Sla: Erro ao atualizar usuário	2025-10-13 17:26:25.143599	2025-10-13 00:00:00	1235689789125	Sei la
65	47	2025-10-13 18:50:16.563312	CRIAR_USUARIO	SUCESSO	FUNCIONARIO Maximo cadastrado com Matrícula 56897	2025-10-13 18:50:16.563312	2025-10-13 00:00:00	56897	Maximo
66	48	2025-10-14 14:19:24.723524	CRIAR_USUARIO	SUCESSO	FUNCIONARIO Cameo cadastrado com Matrícula 56987	2025-10-14 14:19:24.723524	2025-10-14 00:00:00	56987	Cameo
67	48	2025-10-14 14:45:23.487984	EXCLUSAO_USUARIO	SUCESSO	Usuário "Cameo" (tipo=FUNCIONARIO) excluído com sucesso	2025-10-14 14:45:23.487984	2025-10-14 00:00:00	56987	Cameo
68	47	2025-10-14 14:45:26.582125	EXCLUSAO_USUARIO	SUCESSO	Usuário "Maximo" (tipo=FUNCIONARIO) excluído com sucesso	2025-10-14 14:45:26.582125	2025-10-14 00:00:00	56897	Maximo
69	49	2025-10-14 14:46:50.482644	CRIAR_USUARIO	SUCESSO	FUNCIONARIO Máximo cadastrado com Matrícula 89765	2025-10-14 14:46:50.482644	2025-10-14 00:00:00	89765	Máximo
70	49	2025-10-14 14:49:07.308073	EXCLUSAO_USUARIO	SUCESSO	Usuário "Máximo" (tipo=FUNCIONARIO) excluído com sucesso	2025-10-14 14:49:07.308073	2025-10-14 00:00:00	89765	Máximo
71	50	2025-10-14 14:49:18.281926	CRIAR_USUARIO	SUCESSO	FUNCIONARIO Máximo cadastrado com Matrícula 56897	2025-10-14 14:49:18.281926	2025-10-14 00:00:00	56897	Máximo
72	50	2025-10-14 14:50:15.102658	EXCLUSAO_USUARIO	SUCESSO	Usuário "Máximo" (tipo=FUNCIONARIO) excluído com sucesso	2025-10-14 14:50:15.102658	2025-10-14 00:00:00	56897	Máximo
73	51	2025-10-14 14:50:25.402741	CRIAR_USUARIO	SUCESSO	FUNCIONARIO Máximo cadastrado com Matrícula 46887	2025-10-14 14:50:25.402741	2025-10-14 00:00:00	46887	Máximo
74	51	2025-10-14 15:02:20.981782	EXCLUSAO_USUARIO	SUCESSO	Usuário "Máximo" (tipo=FUNCIONARIO) excluído com sucesso	2025-10-14 15:02:20.981782	2025-10-14 00:00:00	46887	Máximo
75	52	2025-10-14 15:02:31.503798	CRIAR_USUARIO	SUCESSO	FUNCIONARIO Maximo cadastrado com Matrícula 45668	2025-10-14 15:02:31.503798	2025-10-14 00:00:00	45668	Maximo
76	52	2025-10-14 15:07:02.141245	EXCLUSAO_USUARIO	SUCESSO	Usuário "Maximo" (tipo=FUNCIONARIO) excluído com sucesso	2025-10-14 15:07:02.141245	2025-10-14 00:00:00	45668	Maximo
77	53	2025-10-14 15:07:12.782966	CRIAR_USUARIO	SUCESSO	FUNCIONARIO Maximo cadastrado com Matrícula 46896	2025-10-14 15:07:12.782966	2025-10-14 00:00:00	46896	Maximo
78	53	2025-10-14 15:14:40.140243	EXCLUSAO_USUARIO	SUCESSO	Usuário "Maximo" (tipo=FUNCIONARIO) excluído com sucesso	2025-10-14 15:14:40.140243	2025-10-14 00:00:00	46896	Maximo
79	54	2025-10-14 15:15:15.713632	CRIAR_USUARIO	SUCESSO	FUNCIONARIO Maximo cadastrado com Matrícula 69853	2025-10-14 15:15:15.713632	2025-10-14 00:00:00	69853	Maximo
80	54	2025-10-14 15:30:38.441127	EXCLUSAO_USUARIO	SUCESSO	Usuário "Maximo" (tipo=FUNCIONARIO) excluído com sucesso	2025-10-14 15:30:38.441127	2025-10-14 00:00:00	69853	Maximo
81	55	2025-10-14 15:56:36.69869	CRIAR_USUARIO	SUCESSO	FUNCIONARIO Teste cadastrado com Matrícula 78563	2025-10-14 15:56:36.69869	2025-10-14 00:00:00	78563	Teste
82	46	2025-10-14 16:09:09.579906	ATUALIZAR_USUARIO	SUCESSO	Usuário ID 46 editado: 	2025-10-14 16:09:09.579906	2025-10-14 00:00:00	1235689789125	Sla
83	40	2025-10-14 16:09:26.87508	ATUALIZAR_USUARIO	SUCESSO	Usuário ID 40 editado: 	2025-10-14 16:09:26.87508	2025-10-14 00:00:00	46588	Allan
84	38	2025-10-14 16:17:11.807409	ATUALIZAR_USUARIO	SUCESSO	Usuário ID 38 editado: 	2025-10-14 16:17:11.807409	2025-10-14 00:00:00	45658	Pora
85	41	2025-10-14 16:31:15.906681	ATUALIZAR_USUARIO	SUCESSO	Usuário ID 41 editado: 	2025-10-14 16:31:15.906681	2025-10-14 00:00:00	56645	Gabriel San
86	41	2025-10-14 19:27:19.834134	ATUALIZAR_USUARIO	SUCESSO	Usuário ID 41 editado: 	2025-10-14 19:27:19.834134	2025-10-14 00:00:00	56645	Gabriel San
87	43	2025-10-14 19:30:43.916078	ATUALIZAR_USUARIO	SUCESSO	Usuário ID 43 editado: 	2025-10-14 19:30:43.916078	2025-10-14 00:00:00	12345	Rafael
174	44	2025-10-16 17:40:26.645379	CADASTRAR_BIOMETRIA	ERRO	Falha ao cadastrar biometria: Erro no cadastro: The received packet do not begin with a valid header!	2025-10-16 17:40:26.645379	2025-10-16 00:00:00	13770	Renato
177	44	2025-10-16 17:41:03.94839	CADASTRAR_BIOMETRIA	ERRO	Falha ao cadastrar biometria: Erro no cadastro: The received packet do not begin with a valid header!	2025-10-16 17:41:03.94839	2025-10-16 00:00:00	13770	Renato
180	44	2025-10-16 17:41:37.81166	CADASTRAR_BIOMETRIA	SUCESSO	Biometria cadastrada para Renato	2025-10-16 17:41:37.81166	2025-10-16 00:00:00	13770	Renato
181	44	2025-10-16 17:41:43.906776	ATUALIZAR_USUARIO	SUCESSO	Usuário ID 44 editado: 	2025-10-16 17:41:43.906776	2025-10-16 00:00:00	13770	Renato
184	59	2025-10-17 15:34:55.653145	CRIAR_USUARIO_COM_BIOMETRIA	ERRO	Falha na biometria: Erro no cadastro: insert or update on table "user_finger" violates foreign key constraint "user_finger_user_id_fkey"\nDETAIL:  Key (user_id)=(59) is not present in table "usuario".\n	2025-10-17 15:34:55.653145	2025-10-17 00:00:00	1234567890123	Jo�o Silva
185	46	2025-10-17 15:36:38.979693	CADASTRAR_BIOMETRIA	SUCESSO	Biometria cadastrada na posição 14	2025-10-17 15:36:38.979693	2025-10-17 00:00:00	1235689789125	Sla
186	46	2025-10-17 15:36:38.991632	CADASTRAR_BIOMETRIA	SUCESSO	Biometria cadastrada na posição 14	2025-10-17 15:36:38.991632	2025-10-17 00:00:00	1235689789125	Sla
187	60	2025-10-17 16:57:25.033382	CRIAR_USUARIO	SUCESSO	FUNCIONARIO Alegre cadastrado sem biometria	2025-10-17 16:57:25.033382	2025-10-17 00:00:00	45632	Alegre
188	60	2025-10-17 16:57:56.477791	CADASTRAR_BIOMETRIA	ERRO	Falha: Erro no cadastro: The received packet do not begin with a valid header!	2025-10-17 16:57:56.477791	2025-10-17 00:00:00	45632	Alegre
189	60	2025-10-17 16:57:56.548325	CADASTRAR_BIOMETRIA	ERRO	Falha: Erro no cadastro: Erro no cadastro: The received packet do not begin with a valid header!	2025-10-17 16:57:56.548325	2025-10-17 00:00:00	45632	Alegre
190	60	2025-10-17 16:58:21.582939	CADASTRAR_BIOMETRIA	SUCESSO	Biometria cadastrada na posição 15	2025-10-17 16:58:21.582939	2025-10-17 00:00:00	45632	Alegre
191	60	2025-10-17 16:58:21.59706	CADASTRAR_BIOMETRIA	SUCESSO	Biometria cadastrada na posição 15	2025-10-17 16:58:21.59706	2025-10-17 00:00:00	45632	Alegre
192	61	2025-10-17 17:07:09.348707	CRIAR_USUARIO	SUCESSO	ESTUDANTE Gabriel Advogado cadastrado sem biometria	2025-10-17 17:07:09.348707	2025-10-17 00:00:00	7894561237894	Gabriel Advogado
193	61	2025-10-17 17:07:24.934058	CADASTRAR_BIOMETRIA	ERRO	Falha: Erro no cadastro: The received packet do not begin with a valid header!	2025-10-17 17:07:24.934058	2025-10-17 00:00:00	7894561237894	Gabriel Advogado
194	61	2025-10-17 17:07:24.947537	CADASTRAR_BIOMETRIA	ERRO	Falha: Erro no cadastro: Erro no cadastro: The received packet do not begin with a valid header!	2025-10-17 17:07:24.947537	2025-10-17 00:00:00	7894561237894	Gabriel Advogado
195	61	2025-10-17 17:07:37.912274	CADASTRAR_BIOMETRIA	ERRO	Falha: Digital já cadastrada na posição 14	2025-10-17 17:07:37.912274	2025-10-17 00:00:00	7894561237894	Gabriel Advogado
196	61	2025-10-17 17:07:37.940933	CADASTRAR_BIOMETRIA	ERRO	Falha: Erro no cadastro: Digital já cadastrada na posição 14	2025-10-17 17:07:37.940933	2025-10-17 00:00:00	7894561237894	Gabriel Advogado
197	61	2025-10-17 17:07:55.882529	CADASTRAR_BIOMETRIA	ERRO	Falha: Erro no cadastro: The received packet do not begin with a valid header!	2025-10-17 17:07:55.882529	2025-10-17 00:00:00	7894561237894	Gabriel Advogado
198	61	2025-10-17 17:07:55.901782	CADASTRAR_BIOMETRIA	ERRO	Falha: Erro no cadastro: Erro no cadastro: The received packet do not begin with a valid header!	2025-10-17 17:07:55.901782	2025-10-17 00:00:00	7894561237894	Gabriel Advogado
199	61	2025-10-17 17:08:03.471743	CADASTRAR_BIOMETRIA	ERRO	Falha: Digitais não correspondem	2025-10-17 17:08:03.471743	2025-10-17 00:00:00	7894561237894	Gabriel Advogado
200	61	2025-10-17 17:08:03.513212	CADASTRAR_BIOMETRIA	ERRO	Falha: Erro no cadastro: Digitais não correspondem	2025-10-17 17:08:03.513212	2025-10-17 00:00:00	7894561237894	Gabriel Advogado
201	61	2025-10-17 17:08:37.852095	CADASTRAR_BIOMETRIA	ERRO	Falha: Erro no cadastro: The received packet do not begin with a valid header!	2025-10-17 17:08:37.852095	2025-10-17 00:00:00	7894561237894	Gabriel Advogado
202	61	2025-10-17 17:08:37.880459	CADASTRAR_BIOMETRIA	ERRO	Falha: Erro no cadastro: Erro no cadastro: The received packet do not begin with a valid header!	2025-10-17 17:08:37.880459	2025-10-17 00:00:00	7894561237894	Gabriel Advogado
203	61	2025-10-17 17:09:04.039459	CADASTRAR_BIOMETRIA	ERRO	Falha: Erro no cadastro: The received packet do not begin with a valid header!	2025-10-17 17:09:04.039459	2025-10-17 00:00:00	7894561237894	Gabriel Advogado
204	61	2025-10-17 17:09:04.048127	CADASTRAR_BIOMETRIA	ERRO	Falha: Erro no cadastro: Erro no cadastro: The received packet do not begin with a valid header!	2025-10-17 17:09:04.048127	2025-10-17 00:00:00	7894561237894	Gabriel Advogado
205	61	2025-10-17 17:09:31.315772	CADASTRAR_BIOMETRIA	ERRO	Falha: Erro no cadastro: The received packet do not begin with a valid header!	2025-10-17 17:09:31.315772	2025-10-17 00:00:00	7894561237894	Gabriel Advogado
206	61	2025-10-17 17:09:31.331252	CADASTRAR_BIOMETRIA	ERRO	Falha: Erro no cadastro: Erro no cadastro: The received packet do not begin with a valid header!	2025-10-17 17:09:31.331252	2025-10-17 00:00:00	7894561237894	Gabriel Advogado
207	61	2025-10-17 17:09:36.730808	CADASTRAR_BIOMETRIA	ERRO	Falha: Sensor não disponível	2025-10-17 17:09:36.730808	2025-10-17 00:00:00	7894561237894	Gabriel Advogado
208	61	2025-10-17 17:09:36.741239	CADASTRAR_BIOMETRIA	ERRO	Falha: Erro no cadastro: Sensor não disponível	2025-10-17 17:09:36.741239	2025-10-17 00:00:00	7894561237894	Gabriel Advogado
209	61	2025-10-17 17:09:39.845593	CADASTRAR_BIOMETRIA	ERRO	Falha: Sensor não disponível	2025-10-17 17:09:39.845593	2025-10-17 00:00:00	7894561237894	Gabriel Advogado
210	61	2025-10-17 17:09:39.854636	CADASTRAR_BIOMETRIA	ERRO	Falha: Erro no cadastro: Sensor não disponível	2025-10-17 17:09:39.854636	2025-10-17 00:00:00	7894561237894	Gabriel Advogado
211	61	2025-10-17 17:10:17.559136	CADASTRAR_BIOMETRIA	ERRO	Falha: Sensor não disponível	2025-10-17 17:10:17.559136	2025-10-17 00:00:00	7894561237894	Gabriel Advogado
212	61	2025-10-17 17:10:17.578058	CADASTRAR_BIOMETRIA	ERRO	Falha: Erro no cadastro: Sensor não disponível	2025-10-17 17:10:17.578058	2025-10-17 00:00:00	7894561237894	Gabriel Advogado
213	61	2025-10-17 17:10:20.059494	CADASTRAR_BIOMETRIA	ERRO	Falha: Sensor não disponível	2025-10-17 17:10:20.059494	2025-10-17 00:00:00	7894561237894	Gabriel Advogado
214	61	2025-10-17 17:10:20.113073	CADASTRAR_BIOMETRIA	ERRO	Falha: Erro no cadastro: Sensor não disponível	2025-10-17 17:10:20.113073	2025-10-17 00:00:00	7894561237894	Gabriel Advogado
215	61	2025-10-17 17:10:21.260593	CADASTRAR_BIOMETRIA	ERRO	Falha: Sensor não disponível	2025-10-17 17:10:21.260593	2025-10-17 00:00:00	7894561237894	Gabriel Advogado
216	61	2025-10-17 17:10:21.273453	CADASTRAR_BIOMETRIA	ERRO	Falha: Erro no cadastro: Sensor não disponível	2025-10-17 17:10:21.273453	2025-10-17 00:00:00	7894561237894	Gabriel Advogado
217	62	2025-10-17 17:10:43.571131	CRIAR_USUARIO	SUCESSO	FUNCIONARIO Gabrielsss cadastrado sem biometria	2025-10-17 17:10:43.571131	2025-10-17 00:00:00	47863	Gabrielsss
218	62	2025-10-17 17:10:45.562423	CADASTRAR_BIOMETRIA	ERRO	Falha: Sensor não disponível	2025-10-17 17:10:45.562423	2025-10-17 00:00:00	47863	Gabrielsss
219	62	2025-10-17 17:10:45.570013	CADASTRAR_BIOMETRIA	ERRO	Falha: Erro no cadastro: Sensor não disponível	2025-10-17 17:10:45.570013	2025-10-17 00:00:00	47863	Gabrielsss
220	62	2025-10-17 17:11:38.11508	CADASTRAR_BIOMETRIA	ERRO	Falha: Sensor não disponível	2025-10-17 17:11:38.11508	2025-10-17 00:00:00	47863	Gabrielsss
221	62	2025-10-17 17:11:38.157271	CADASTRAR_BIOMETRIA	ERRO	Falha: Erro no cadastro: Sensor não disponível	2025-10-17 17:11:38.157271	2025-10-17 00:00:00	47863	Gabrielsss
222	62	2025-10-17 17:11:40.337425	CADASTRAR_BIOMETRIA	ERRO	Falha: Sensor não disponível	2025-10-17 17:11:40.337425	2025-10-17 00:00:00	47863	Gabrielsss
223	62	2025-10-17 17:11:40.345893	CADASTRAR_BIOMETRIA	ERRO	Falha: Erro no cadastro: Sensor não disponível	2025-10-17 17:11:40.345893	2025-10-17 00:00:00	47863	Gabrielsss
224	62	2025-10-17 17:11:40.846539	CADASTRAR_BIOMETRIA	ERRO	Falha: Sensor não disponível	2025-10-17 17:11:40.846539	2025-10-17 00:00:00	47863	Gabrielsss
225	62	2025-10-17 17:11:40.878062	CADASTRAR_BIOMETRIA	ERRO	Falha: Erro no cadastro: Sensor não disponível	2025-10-17 17:11:40.878062	2025-10-17 00:00:00	47863	Gabrielsss
226	62	2025-10-17 17:11:41.356294	CADASTRAR_BIOMETRIA	ERRO	Falha: Sensor não disponível	2025-10-17 17:11:41.356294	2025-10-17 00:00:00	47863	Gabrielsss
227	62	2025-10-17 17:11:41.364092	CADASTRAR_BIOMETRIA	ERRO	Falha: Erro no cadastro: Sensor não disponível	2025-10-17 17:11:41.364092	2025-10-17 00:00:00	47863	Gabrielsss
228	62	2025-10-17 17:11:41.518796	CADASTRAR_BIOMETRIA	ERRO	Falha: Sensor não disponível	2025-10-17 17:11:41.518796	2025-10-17 00:00:00	47863	Gabrielsss
229	62	2025-10-17 17:11:41.533301	CADASTRAR_BIOMETRIA	ERRO	Falha: Erro no cadastro: Sensor não disponível	2025-10-17 17:11:41.533301	2025-10-17 00:00:00	47863	Gabrielsss
230	62	2025-10-17 17:11:41.675112	CADASTRAR_BIOMETRIA	ERRO	Falha: Sensor não disponível	2025-10-17 17:11:41.675112	2025-10-17 00:00:00	47863	Gabrielsss
231	62	2025-10-17 17:11:41.688077	CADASTRAR_BIOMETRIA	ERRO	Falha: Erro no cadastro: Sensor não disponível	2025-10-17 17:11:41.688077	2025-10-17 00:00:00	47863	Gabrielsss
232	62	2025-10-17 17:11:42.036652	CADASTRAR_BIOMETRIA	ERRO	Falha: Sensor não disponível	2025-10-17 17:11:42.036652	2025-10-17 00:00:00	47863	Gabrielsss
233	62	2025-10-17 17:11:42.048378	CADASTRAR_BIOMETRIA	ERRO	Falha: Erro no cadastro: Sensor não disponível	2025-10-17 17:11:42.048378	2025-10-17 00:00:00	47863	Gabrielsss
234	62	2025-10-17 17:11:42.156024	CADASTRAR_BIOMETRIA	ERRO	Falha: Sensor não disponível	2025-10-17 17:11:42.156024	2025-10-17 00:00:00	47863	Gabrielsss
235	62	2025-10-17 17:11:42.168536	CADASTRAR_BIOMETRIA	ERRO	Falha: Erro no cadastro: Sensor não disponível	2025-10-17 17:11:42.168536	2025-10-17 00:00:00	47863	Gabrielsss
236	62	2025-10-17 17:11:42.299515	CADASTRAR_BIOMETRIA	ERRO	Falha: Sensor não disponível	2025-10-17 17:11:42.299515	2025-10-17 00:00:00	47863	Gabrielsss
237	62	2025-10-17 17:11:42.307439	CADASTRAR_BIOMETRIA	ERRO	Falha: Erro no cadastro: Sensor não disponível	2025-10-17 17:11:42.307439	2025-10-17 00:00:00	47863	Gabrielsss
238	62	2025-10-17 17:11:42.489639	CADASTRAR_BIOMETRIA	ERRO	Falha: Sensor não disponível	2025-10-17 17:11:42.489639	2025-10-17 00:00:00	47863	Gabrielsss
239	62	2025-10-17 17:11:42.499009	CADASTRAR_BIOMETRIA	ERRO	Falha: Erro no cadastro: Sensor não disponível	2025-10-17 17:11:42.499009	2025-10-17 00:00:00	47863	Gabrielsss
240	62	2025-10-17 17:11:42.652831	CADASTRAR_BIOMETRIA	ERRO	Falha: Sensor não disponível	2025-10-17 17:11:42.652831	2025-10-17 00:00:00	47863	Gabrielsss
241	62	2025-10-17 17:11:42.66653	CADASTRAR_BIOMETRIA	ERRO	Falha: Erro no cadastro: Sensor não disponível	2025-10-17 17:11:42.66653	2025-10-17 00:00:00	47863	Gabrielsss
242	62	2025-10-17 17:11:42.782912	CADASTRAR_BIOMETRIA	ERRO	Falha: Sensor não disponível	2025-10-17 17:11:42.782912	2025-10-17 00:00:00	47863	Gabrielsss
243	62	2025-10-17 17:11:42.796701	CADASTRAR_BIOMETRIA	ERRO	Falha: Erro no cadastro: Sensor não disponível	2025-10-17 17:11:42.796701	2025-10-17 00:00:00	47863	Gabrielsss
244	62	2025-10-17 17:11:42.947503	CADASTRAR_BIOMETRIA	ERRO	Falha: Sensor não disponível	2025-10-17 17:11:42.947503	2025-10-17 00:00:00	47863	Gabrielsss
245	62	2025-10-17 17:11:42.961581	CADASTRAR_BIOMETRIA	ERRO	Falha: Erro no cadastro: Sensor não disponível	2025-10-17 17:11:42.961581	2025-10-17 00:00:00	47863	Gabrielsss
246	61	2025-10-17 17:12:36.932537	CADASTRAR_BIOMETRIA	SUCESSO	Biometria cadastrada na posição 16	2025-10-17 17:12:36.932537	2025-10-17 00:00:00	7894561237894	Gabriel Advogado
247	61	2025-10-17 17:12:36.946712	CADASTRAR_BIOMETRIA	SUCESSO	Biometria cadastrada na posição 16	2025-10-17 17:12:36.946712	2025-10-17 00:00:00	7894561237894	Gabriel Advogado
248	38	2025-10-17 17:23:04.263917	CADASTRAR_BIOMETRIA	SUCESSO	Biometria cadastrada na posição 17	2025-10-17 17:23:04.263917	2025-10-17 00:00:00	45658	Pora
249	38	2025-10-17 17:23:04.281924	CADASTRAR_BIOMETRIA	SUCESSO	Biometria cadastrada na posição 17	2025-10-17 17:23:04.281924	2025-10-17 00:00:00	45658	Pora
250	63	2025-10-20 19:15:56.58869	CRIAR_USUARIO	SUCESSO	FUNCIONARIO Rod cadastrado sem biometria	2025-10-20 19:15:56.58869	2025-10-20 00:00:00	14896	Rod
251	64	2025-10-21 21:40:59.335861	CRIAR_USUARIO	SUCESSO	FUNCIONARIO SALT cadastrado sem biometria	2025-10-21 21:40:59.335861	2025-10-21 00:00:00	56542	SALT
252	65	2025-10-28 17:35:07.299698	CRIAR_USUARIO_SISTEMA	SUCESSO	Usuário do sistema PORTARIA criado	2025-10-28 17:35:07.299698	2025-10-28 00:00:00	46588	Allan
253	66	2025-10-30 15:14:55.827729	CRIAR_USUARIO	SUCESSO	Usuário VISITANTE criado	2025-10-30 15:14:55.827729	2025-10-30 00:00:00	591374387	Allan
254	66	2025-10-30 15:14:55.887491	CRIAR_VISITANTE	SUCESSO	Visitante Allan cadastrado sem biometria	2025-10-30 15:14:55.887491	2025-10-30 00:00:00	591374387	Allan
255	66	2025-10-30 15:15:32.267812	CADASTRAR_BIOMETRIA	SUCESSO	Biometria cadastrada na posição 18	2025-10-30 15:15:32.267812	2025-10-30 00:00:00	591374387	Allan
256	66	2025-10-30 15:15:32.286231	CADASTRAR_BIOMETRIA_VISITANTE	SUCESSO	Biometria de visitante cadastrada na posição 18	2025-10-30 15:15:32.286231	2025-10-30 00:00:00	591374387	Allan
257	66	2025-10-30 15:20:53.282622	CADASTRAR_BIOMETRIA	SUCESSO	Biometria cadastrada na posição 19	2025-10-30 15:20:53.282622	2025-10-30 00:00:00	591374387	Allan
258	66	2025-10-30 15:20:53.291457	CADASTRAR_BIOMETRIA	SUCESSO	Biometria cadastrada na posição 19	2025-10-30 15:20:53.291457	2025-10-30 00:00:00	591374387	Allan
259	67	2025-10-31 17:57:35.941243	CRIAR_USUARIO	SUCESSO	Usuário ESTUDANTE criado	2025-10-31 17:57:35.941243	2025-10-31 00:00:00	1235655965893	SalgadoEstudante
260	67	2025-10-31 17:57:35.960743	CRIAR_USUARIO	SUCESSO	ESTUDANTE SalgadoEstudante cadastrado sem biometria	2025-10-31 17:57:35.960743	2025-10-31 00:00:00	1235655965893	SalgadoEstudante
261	67	2025-10-31 17:57:57.325743	CADASTRAR_BIOMETRIA	ERRO	Falha: Erro no cadastro: The received packet do not begin with a valid header!	2025-10-31 17:57:57.325743	2025-10-31 00:00:00	1235655965893	SalgadoEstudante
262	67	2025-10-31 17:57:57.348888	CADASTRAR_BIOMETRIA	ERRO	Falha: Erro no cadastro: Erro no cadastro: The received packet do not begin with a valid header!	2025-10-31 17:57:57.348888	2025-10-31 00:00:00	1235655965893	SalgadoEstudante
263	67	2025-10-31 17:58:32.116738	CADASTRAR_BIOMETRIA	ERRO	Falha: Erro no cadastro: The received packet do not begin with a valid header!	2025-10-31 17:58:32.116738	2025-10-31 00:00:00	1235655965893	SalgadoEstudante
264	67	2025-10-31 17:58:32.137636	CADASTRAR_BIOMETRIA	ERRO	Falha: Erro no cadastro: Erro no cadastro: The received packet do not begin with a valid header!	2025-10-31 17:58:32.137636	2025-10-31 00:00:00	1235655965893	SalgadoEstudante
265	67	2025-10-31 17:58:49.270027	CADASTRAR_BIOMETRIA	ERRO	Falha: Erro no cadastro: The received packet do not begin with a valid header!	2025-10-31 17:58:49.270027	2025-10-31 00:00:00	1235655965893	SalgadoEstudante
266	67	2025-10-31 17:58:49.301736	CADASTRAR_BIOMETRIA	ERRO	Falha: Erro no cadastro: Erro no cadastro: The received packet do not begin with a valid header!	2025-10-31 17:58:49.301736	2025-10-31 00:00:00	1235655965893	SalgadoEstudante
267	67	2025-10-31 17:59:16.566097	CADASTRAR_BIOMETRIA	ERRO	Falha: Digitais não correspondem	2025-10-31 17:59:16.566097	2025-10-31 00:00:00	1235655965893	SalgadoEstudante
268	67	2025-10-31 17:59:16.600901	CADASTRAR_BIOMETRIA	ERRO	Falha: Erro no cadastro: Digitais não correspondem	2025-10-31 17:59:16.600901	2025-10-31 00:00:00	1235655965893	SalgadoEstudante
269	67	2025-10-31 17:59:20.130512	CADASTRAR_BIOMETRIA	ERRO	Falha: Erro no cadastro: device reports readiness to read but returned no data (device disconnected or multiple access on port?)	2025-10-31 17:59:20.130512	2025-10-31 00:00:00	1235655965893	SalgadoEstudante
270	67	2025-10-31 17:59:20.156327	CADASTRAR_BIOMETRIA	ERRO	Falha: Erro no cadastro: Erro no cadastro: device reports readiness to read but returned no data (device disconnected or multiple access on port?)	2025-10-31 17:59:20.156327	2025-10-31 00:00:00	1235655965893	SalgadoEstudante
271	67	2025-10-31 18:00:07.372774	CADASTRAR_BIOMETRIA	ERRO	Falha: Erro no cadastro: unsupported operand type(s) for <<: 'bytes' and 'int'	2025-10-31 18:00:07.372774	2025-10-31 00:00:00	1235655965893	SalgadoEstudante
272	67	2025-10-31 18:00:07.413732	CADASTRAR_BIOMETRIA	ERRO	Falha: Erro no cadastro: Erro no cadastro: unsupported operand type(s) for <<: 'bytes' and 'int'	2025-10-31 18:00:07.413732	2025-10-31 00:00:00	1235655965893	SalgadoEstudante
273	67	2025-10-31 18:07:49.392649	CADASTRAR_BIOMETRIA	ERRO	Falha: Digitais não correspondem	2025-10-31 18:07:49.392649	2025-10-31 00:00:00	1235655965893	SalgadoEstudante
274	67	2025-10-31 18:07:49.438399	CADASTRAR_BIOMETRIA	ERRO	Falha: Erro no cadastro: Digitais não correspondem	2025-10-31 18:07:49.438399	2025-10-31 00:00:00	1235655965893	SalgadoEstudante
275	68	2025-10-31 18:09:52.863596	CRIAR_USUARIO	SUCESSO	Usuário VISITANTE criado	2025-10-31 18:09:52.863596	2025-10-31 00:00:00	156321489	Bozelli
276	68	2025-10-31 18:09:52.885378	CRIAR_VISITANTE	SUCESSO	Visitante Bozelli cadastrado sem biometria	2025-10-31 18:09:52.885378	2025-10-31 00:00:00	156321489	Bozelli
277	68	2025-10-31 18:10:03.857812	CADASTRAR_BIOMETRIA	ERRO	Falha: Erro no cadastro: device reports readiness to read but returned no data (device disconnected or multiple access on port?)	2025-10-31 18:10:03.857812	2025-10-31 00:00:00	156321489	Bozelli
278	68	2025-10-31 18:10:03.915202	CADASTRAR_BIOMETRIA_VISITANTE	ERRO	Falha: Erro no cadastro: Erro no cadastro: device reports readiness to read but returned no data (device disconnected or multiple access on port?)	2025-10-31 18:10:03.915202	2025-10-31 00:00:00	156321489	Bozelli
279	68	2025-10-31 18:10:10.987684	CADASTRAR_BIOMETRIA	ERRO	Falha: Erro no cadastro: device reports readiness to read but returned no data (device disconnected or multiple access on port?)	2025-10-31 18:10:10.987684	2025-10-31 00:00:00	156321489	Bozelli
280	68	2025-10-31 18:10:11.001636	CADASTRAR_BIOMETRIA_VISITANTE	ERRO	Falha: Erro no cadastro: Erro no cadastro: device reports readiness to read but returned no data (device disconnected or multiple access on port?)	2025-10-31 18:10:11.001636	2025-10-31 00:00:00	156321489	Bozelli
281	68	2025-10-31 18:10:17.118559	CADASTRAR_BIOMETRIA	ERRO	Falha: Erro no cadastro: device reports readiness to read but returned no data (device disconnected or multiple access on port?)	2025-10-31 18:10:17.118559	2025-10-31 00:00:00	156321489	Bozelli
282	68	2025-10-31 18:10:17.136971	CADASTRAR_BIOMETRIA_VISITANTE	ERRO	Falha: Erro no cadastro: Erro no cadastro: device reports readiness to read but returned no data (device disconnected or multiple access on port?)	2025-10-31 18:10:17.136971	2025-10-31 00:00:00	156321489	Bozelli
283	60	2025-11-03 14:40:24.767265	CADASTRAR_BIOMETRIA	SUCESSO	Biometria cadastrada na posição 0	2025-11-03 14:40:24.767265	2025-11-03 00:00:00	45632	Alegre
284	60	2025-11-03 14:40:24.78432	CADASTRAR_BIOMETRIA	SUCESSO	Biometria cadastrada na posição 0	2025-11-03 14:40:24.78432	2025-11-03 00:00:00	45632	Alegre
285	66	2025-11-03 17:01:41.239515	CADASTRAR_BIOMETRIA	SUCESSO	Biometria cadastrada na posição 1	2025-11-03 17:01:41.239515	2025-11-03 00:00:00	591374387	Allan
286	66	2025-11-03 17:01:41.251087	CADASTRAR_BIOMETRIA	SUCESSO	Biometria cadastrada na posição 1	2025-11-03 17:01:41.251087	2025-11-03 00:00:00	591374387	Allan
287	61	2025-11-03 17:25:05.428642	CADASTRAR_BIOMETRIA	SUCESSO	Biometria cadastrada na posição 2	2025-11-03 17:25:05.428642	2025-11-03 00:00:00	7894561237894	Gabriel Advogado
288	61	2025-11-03 17:25:05.455396	CADASTRAR_BIOMETRIA	SUCESSO	Biometria cadastrada na posição 2	2025-11-03 17:25:05.455396	2025-11-03 00:00:00	7894561237894	Gabriel Advogado
289	40	2025-11-04 12:26:57.582541	CADASTRAR_BIOMETRIA	SUCESSO	Biometria cadastrada na posição undefined	2025-11-04 12:26:57.582541	2025-11-04 00:00:00	46588	Allan
290	68	2025-11-04 12:28:33.307198	CADASTRAR_BIOMETRIA	SUCESSO	Biometria cadastrada na posição undefined	2025-11-04 12:28:33.307198	2025-11-04 00:00:00	156321489	Bozelli
291	41	2025-11-04 14:26:05.874762	CADASTRAR_BIOMETRIA	ERRO	Falha: Digitais não correspondem	2025-11-04 14:26:05.874762	2025-11-04 00:00:00	56645	Gabriel San
292	41	2025-11-04 14:26:05.891214	CADASTRAR_BIOMETRIA	ERRO	Falha: Erro no cadastro: Digitais não correspondem	2025-11-04 14:26:05.891214	2025-11-04 00:00:00	56645	Gabriel San
293	68	2025-11-04 14:28:15.228958	CADASTRAR_BIOMETRIA	SUCESSO	Biometria cadastrada na posição undefined	2025-11-04 14:28:15.228958	2025-11-04 00:00:00	156321489	Bozelli
294	41	2025-11-04 14:30:38.826845	CADASTRAR_BIOMETRIA	SUCESSO	Biometria cadastrada na posição undefined	2025-11-04 14:30:38.826845	2025-11-04 00:00:00	56645	Gabriel San
295	41	2025-11-04 14:34:51.408807	CADASTRAR_BIOMETRIA	ERRO	Falha: Timeout - falha ao detectar dedo na primeira leitura	2025-11-04 14:34:51.408807	2025-11-04 00:00:00	56645	Gabriel San
296	41	2025-11-04 14:35:21.006478	CADASTRAR_BIOMETRIA	ERRO	Falha: Erro no cadastro: device reports readiness to read but returned no data (device disconnected or multiple access on port?)	2025-11-04 14:35:21.006478	2025-11-04 00:00:00	56645	Gabriel San
297	41	2025-11-04 14:35:21.07167	CADASTRAR_BIOMETRIA	ERRO	Falha: Erro no cadastro: Erro no cadastro: device reports readiness to read but returned no data (device disconnected or multiple access on port?)	2025-11-04 14:35:21.07167	2025-11-04 00:00:00	56645	Gabriel San
298	41	2025-11-04 14:36:06.383251	CADASTRAR_BIOMETRIA	ERRO	Falha: Digital já cadastrada na posição 4	2025-11-04 14:36:06.383251	2025-11-04 00:00:00	56645	Gabriel San
299	41	2025-11-04 14:36:06.414077	CADASTRAR_BIOMETRIA	ERRO	Falha: Erro no cadastro: Digital já cadastrada na posição 4	2025-11-04 14:36:06.414077	2025-11-04 00:00:00	56645	Gabriel San
300	41	2025-11-04 14:36:30.722629	CADASTRAR_BIOMETRIA	ERRO	Falha: Erro no cadastro: The received packet do not begin with a valid header!	2025-11-04 14:36:30.722629	2025-11-04 00:00:00	56645	Gabriel San
301	41	2025-11-04 14:36:30.751179	CADASTRAR_BIOMETRIA	ERRO	Falha: Erro no cadastro: Erro no cadastro: The received packet do not begin with a valid header!	2025-11-04 14:36:30.751179	2025-11-04 00:00:00	56645	Gabriel San
302	41	2025-11-04 14:37:12.160924	CADASTRAR_BIOMETRIA	SUCESSO	Biometria cadastrada na posição undefined	2025-11-04 14:37:12.160924	2025-11-04 00:00:00	56645	Gabriel San
303	68	2025-11-04 14:51:29.90932	CADASTRAR_BIOMETRIA	ERRO	Falha: Erro no cadastro: device reports readiness to read but returned no data (device disconnected or multiple access on port?)	2025-11-04 14:51:29.90932	2025-11-04 00:00:00	156321489	Bozelli
304	68	2025-11-04 14:51:29.937084	CADASTRAR_BIOMETRIA	ERRO	Falha: Erro no cadastro: Erro no cadastro: device reports readiness to read but returned no data (device disconnected or multiple access on port?)	2025-11-04 14:51:29.937084	2025-11-04 00:00:00	156321489	Bozelli
305	41	2025-11-04 14:55:46.741079	CADASTRAR_BIOMETRIA	ERRO	Falha: Digital já cadastrada na posição 7	2025-11-04 14:55:46.741079	2025-11-04 00:00:00	56645	Gabriel San
306	41	2025-11-04 14:55:46.841566	CADASTRAR_BIOMETRIA	ERRO	Falha: Erro no cadastro: Digital já cadastrada na posição 7	2025-11-04 14:55:46.841566	2025-11-04 00:00:00	56645	Gabriel San
307	41	2025-11-04 14:56:14.247001	CADASTRAR_BIOMETRIA	ERRO	Falha: Digital já cadastrada na posição 4	2025-11-04 14:56:14.247001	2025-11-04 00:00:00	56645	Gabriel San
308	41	2025-11-04 14:56:14.269099	CADASTRAR_BIOMETRIA	ERRO	Falha: Erro no cadastro: Digital já cadastrada na posição 4	2025-11-04 14:56:14.269099	2025-11-04 00:00:00	56645	Gabriel San
309	41	2025-11-04 14:57:03.727267	CADASTRAR_BIOMETRIA	ERRO	Falha: Timeout - falha ao detectar dedo na primeira leitura	2025-11-04 14:57:03.727267	2025-11-04 00:00:00	56645	Gabriel San
310	41	2025-11-04 14:57:39.398357	CADASTRAR_BIOMETRIA	ERRO	Falha: Timeout - falha ao detectar dedo na primeira leitura	2025-11-04 14:57:39.398357	2025-11-04 00:00:00	56645	Gabriel San
311	41	2025-11-04 14:58:16.048256	CADASTRAR_BIOMETRIA	ERRO	Falha: Timeout - falha ao detectar dedo na primeira leitura	2025-11-04 14:58:16.048256	2025-11-04 00:00:00	56645	Gabriel San
312	41	2025-11-04 14:58:49.736661	CADASTRAR_BIOMETRIA	ERRO	Falha: Erro no cadastro: The received packet do not begin with a valid header!	2025-11-04 14:58:49.736661	2025-11-04 00:00:00	56645	Gabriel San
313	41	2025-11-04 14:58:49.755915	CADASTRAR_BIOMETRIA	ERRO	Falha: Erro no cadastro: Erro no cadastro: The received packet do not begin with a valid header!	2025-11-04 14:58:49.755915	2025-11-04 00:00:00	56645	Gabriel San
314	40	2025-11-04 15:16:29.901039	CADASTRAR_BIOMETRIA	ERRO	Falha: Digital já cadastrada na posição 4	2025-11-04 15:16:29.901039	2025-11-04 00:00:00	46588	Allan
315	40	2025-11-04 15:16:29.933034	CADASTRAR_BIOMETRIA	ERRO	Falha: Erro no cadastro: Digital já cadastrada na posição 4	2025-11-04 15:16:29.933034	2025-11-04 00:00:00	46588	Allan
316	62	2025-11-04 15:35:44.264385	CADASTRAR_BIOMETRIA	SUCESSO	Biometria cadastrada na posição undefined	2025-11-04 15:35:44.264385	2025-11-04 00:00:00	47863	Gabrielsss
317	61	2025-11-04 15:38:42.859858	CADASTRAR_BIOMETRIA	ERRO	Falha: Erro no cadastro: The received packet is corrupted (the checksum is wrong)!	2025-11-04 15:38:42.859858	2025-11-04 00:00:00	7894561237894	Gabriel Advogado
318	61	2025-11-04 15:38:42.888375	CADASTRAR_BIOMETRIA	ERRO	Falha: Erro no cadastro: Erro no cadastro: The received packet is corrupted (the checksum is wrong)!	2025-11-04 15:38:42.888375	2025-11-04 00:00:00	7894561237894	Gabriel Advogado
319	61	2025-11-04 15:39:47.84346	CADASTRAR_BIOMETRIA	SUCESSO	Biometria cadastrada na posição undefined	2025-11-04 15:39:47.84346	2025-11-04 00:00:00	7894561237894	Gabriel Advogado
320	60	2025-11-05 15:07:06.741848	CADASTRAR_BIOMETRIA	SUCESSO	Biometria cadastrada na posição undefined	2025-11-05 15:07:06.741848	2025-11-05 00:00:00	45632	Alegre
321	60	2025-11-05 15:07:45.701842	CADASTRAR_BIOMETRIA	ERRO	Falha: Digital já cadastrada na posição 0	2025-11-05 15:07:45.701842	2025-11-05 00:00:00	45632	Alegre
322	60	2025-11-05 15:07:45.727533	CADASTRAR_BIOMETRIA	ERRO	Falha: Erro no cadastro: Digital já cadastrada na posição 0	2025-11-05 15:07:45.727533	2025-11-05 00:00:00	45632	Alegre
323	60	2025-11-05 15:24:37.000561	CADASTRAR_BIOMETRIA	ERRO	Falha: Digital já cadastrada na posição 0	2025-11-05 15:24:37.000561	2025-11-05 00:00:00	45632	Alegre
324	60	2025-11-05 15:24:37.08944	CADASTRAR_BIOMETRIA	ERRO	Falha: Erro no cadastro: Digital já cadastrada na posição 0	2025-11-05 15:24:37.08944	2025-11-05 00:00:00	45632	Alegre
325	60	2025-11-05 15:24:53.717127	CADASTRAR_BIOMETRIA	SUCESSO	Biometria cadastrada na posição undefined	2025-11-05 15:24:53.717127	2025-11-05 00:00:00	45632	Alegre
326	60	2025-11-05 18:30:00.275607	CADASTRAR_BIOMETRIA	ERRO	Falha: CATRACA_API_URL is not defined	2025-11-05 18:30:00.275607	2025-11-05 00:00:00	45632	Alegre
327	60	2025-11-05 18:30:00.326572	CADASTRAR_BIOMETRIA	ERRO	Falha: Erro no cadastro: CATRACA_API_URL is not defined	2025-11-05 18:30:00.326572	2025-11-05 00:00:00	45632	Alegre
328	60	2025-11-05 18:30:04.444462	CADASTRAR_BIOMETRIA	ERRO	Falha: CATRACA_API_URL is not defined	2025-11-05 18:30:04.444462	2025-11-05 00:00:00	45632	Alegre
329	60	2025-11-05 18:30:04.467733	CADASTRAR_BIOMETRIA	ERRO	Falha: Erro no cadastro: CATRACA_API_URL is not defined	2025-11-05 18:30:04.467733	2025-11-05 00:00:00	45632	Alegre
330	60	2025-11-05 18:30:07.023498	CADASTRAR_BIOMETRIA	ERRO	Falha: CATRACA_API_URL is not defined	2025-11-05 18:30:07.023498	2025-11-05 00:00:00	45632	Alegre
331	60	2025-11-05 18:30:07.064313	CADASTRAR_BIOMETRIA	ERRO	Falha: Erro no cadastro: CATRACA_API_URL is not defined	2025-11-05 18:30:07.064313	2025-11-05 00:00:00	45632	Alegre
332	60	2025-11-05 18:31:16.954714	CADASTRAR_BIOMETRIA	ERRO	Falha: Digitais não correspondem	2025-11-05 18:31:16.954714	2025-11-05 00:00:00	45632	Alegre
333	60	2025-11-05 18:31:16.985816	CADASTRAR_BIOMETRIA	ERRO	Falha: Erro no cadastro: Digitais não correspondem	2025-11-05 18:31:16.985816	2025-11-05 00:00:00	45632	Alegre
334	60	2025-11-05 18:32:05.304287	CADASTRAR_BIOMETRIA	ERRO	Falha: Erro no cadastro: The received packet do not begin with a valid header!	2025-11-05 18:32:05.304287	2025-11-05 00:00:00	45632	Alegre
335	60	2025-11-05 18:32:39.150709	CADASTRAR_BIOMETRIA	ERRO	Falha: Erro no cadastro: The received packet do not begin with a valid header!	2025-11-05 18:32:39.150709	2025-11-05 00:00:00	45632	Alegre
336	66	2025-11-05 18:32:54.370028	CADASTRAR_BIOMETRIA	ERRO	Falha: Erro no cadastro: device reports readiness to read but returned no data (device disconnected or multiple access on port?)	2025-11-05 18:32:54.370028	2025-11-05 00:00:00	591374387	Allan
337	66	2025-11-05 18:32:54.388614	CADASTRAR_BIOMETRIA	ERRO	Falha: Erro no cadastro: Erro no cadastro: device reports readiness to read but returned no data (device disconnected or multiple access on port?)	2025-11-05 18:32:54.388614	2025-11-05 00:00:00	591374387	Allan
338	66	2025-11-05 18:33:15.636676	CADASTRAR_BIOMETRIA	SUCESSO	Biometria cadastrada na posição undefined	2025-11-05 18:33:15.636676	2025-11-05 00:00:00	591374387	Allan
339	60	2025-11-05 18:53:59.019577	CADASTRAR_BIOMETRIA	ERRO	Falha: Já existe um cadastro em andamento	2025-11-05 18:53:59.019577	2025-11-05 00:00:00	45632	Alegre
340	60	2025-11-05 18:53:59.072212	CADASTRAR_BIOMETRIA	ERRO	Falha: Erro no cadastro: Já existe um cadastro em andamento	2025-11-05 18:53:59.072212	2025-11-05 00:00:00	45632	Alegre
341	60	2025-11-05 18:54:05.360141	CADASTRAR_BIOMETRIA	ERRO	Falha: Erro no cadastro: device reports readiness to read but returned no data (device disconnected or multiple access on port?)	2025-11-05 18:54:05.360141	2025-11-05 00:00:00	45632	Alegre
342	60	2025-11-05 18:54:46.028902	CADASTRAR_BIOMETRIA	SUCESSO	Biometria cadastrada na posição undefined	2025-11-05 18:54:46.028902	2025-11-05 00:00:00	45632	Alegre
343	40	2025-11-10 17:18:51.849677	CADASTRAR_BIOMETRIA	ERRO	Falha: Já existe um cadastro em andamento	2025-11-10 17:18:51.849677	2025-11-10 00:00:00	46588	Allan
344	40	2025-11-10 17:18:51.887469	CADASTRAR_BIOMETRIA	ERRO	Falha: Erro no cadastro: Já existe um cadastro em andamento	2025-11-10 17:18:51.887469	2025-11-10 00:00:00	46588	Allan
345	40	2025-11-10 17:18:55.095953	CADASTRAR_BIOMETRIA	ERRO	Falha: Já existe um cadastro em andamento	2025-11-10 17:18:55.095953	2025-11-10 00:00:00	46588	Allan
346	40	2025-11-10 17:18:55.11628	CADASTRAR_BIOMETRIA	ERRO	Falha: Erro no cadastro: Já existe um cadastro em andamento	2025-11-10 17:18:55.11628	2025-11-10 00:00:00	46588	Allan
347	40	2025-11-10 17:19:10.315137	CADASTRAR_BIOMETRIA	ERRO	Falha: Timeout - falha ao detectar dedo na segunda leitura	2025-11-10 17:19:10.315137	2025-11-10 00:00:00	46588	Allan
348	40	2025-11-10 17:19:47.412893	CADASTRAR_BIOMETRIA	ERRO	Falha: Timeout - falha ao detectar dedo na primeira leitura	2025-11-10 17:19:47.412893	2025-11-10 00:00:00	46588	Allan
349	40	2025-11-10 17:21:08.091275	CADASTRAR_BIOMETRIA	ERRO	Falha: Erro no cadastro: device reports readiness to read but returned no data (device disconnected or multiple access on port?)	2025-11-10 17:21:08.091275	2025-11-10 00:00:00	46588	Allan
350	40	2025-11-10 17:21:08.116772	CADASTRAR_BIOMETRIA	ERRO	Falha: Erro no cadastro: Erro no cadastro: device reports readiness to read but returned no data (device disconnected or multiple access on port?)	2025-11-10 17:21:08.116772	2025-11-10 00:00:00	46588	Allan
351	40	2025-11-10 17:21:20.466767	EXCLUSAO_USUARIO	SUCESSO	Usuário "Allan" (tipo=FUNCIONARIO) excluído com sucesso	2025-11-10 17:21:20.466767	2025-11-10 00:00:00	46588	Allan
352	69	2025-11-10 17:21:37.386736	CRIAR_USUARIO	SUCESSO	Usuário ESTUDANTE criado	2025-11-10 17:21:37.386736	2025-11-10 00:00:00	9874125669874	Pouzelli
353	69	2025-11-10 17:21:37.432407	CRIAR_USUARIO	SUCESSO	ESTUDANTE Pouzelli cadastrado sem biometria	2025-11-10 17:21:37.432407	2025-11-10 00:00:00	9874125669874	Pouzelli
354	69	2025-11-10 17:21:49.696031	CADASTRAR_BIOMETRIA	SUCESSO	Biometria cadastrada na posição undefined	2025-11-10 17:21:49.696031	2025-11-10 00:00:00	9874125669874	Pouzelli
355	69	2025-11-10 17:22:49.591244	EXCLUSAO_USUARIO	SUCESSO	Usuário "Pouzelli" (tipo=ESTUDANTE) excluído com sucesso	2025-11-10 17:22:49.591244	2025-11-10 00:00:00	9874125669874	Pouzelli
356	70	2025-11-10 17:23:01.019256	CRIAR_USUARIO	SUCESSO	Usuário FUNCIONARIO criado	2025-11-10 17:23:01.019256	2025-11-10 00:00:00	98545	Pouzelli
357	70	2025-11-10 17:23:01.039161	CRIAR_USUARIO	SUCESSO	FUNCIONARIO Pouzelli cadastrado sem biometria	2025-11-10 17:23:01.039161	2025-11-10 00:00:00	98545	Pouzelli
358	70	2025-11-10 17:23:19.872641	CADASTRAR_BIOMETRIA	ERRO	Falha: Erro no cadastro: The received packet do not begin with a valid header!	2025-11-10 17:23:19.872641	2025-11-10 00:00:00	98545	Pouzelli
359	70	2025-11-10 17:23:37.142477	CADASTRAR_BIOMETRIA	SUCESSO	Biometria cadastrada na posição undefined	2025-11-10 17:23:37.142477	2025-11-10 00:00:00	98545	Pouzelli
360	45	2025-11-10 17:25:21.005999	CADASTRAR_BIOMETRIA	ERRO	Falha: Já existe um cadastro em andamento	2025-11-10 17:25:21.005999	2025-11-10 00:00:00	11111	Salgado
361	45	2025-11-10 17:25:21.054665	CADASTRAR_BIOMETRIA	ERRO	Falha: Erro no cadastro: Já existe um cadastro em andamento	2025-11-10 17:25:21.054665	2025-11-10 00:00:00	11111	Salgado
362	45	2025-11-10 17:25:22.575854	CADASTRAR_BIOMETRIA	ERRO	Falha: Já existe um cadastro em andamento	2025-11-10 17:25:22.575854	2025-11-10 00:00:00	11111	Salgado
363	45	2025-11-10 17:25:22.595265	CADASTRAR_BIOMETRIA	ERRO	Falha: Erro no cadastro: Já existe um cadastro em andamento	2025-11-10 17:25:22.595265	2025-11-10 00:00:00	11111	Salgado
364	45	2025-11-10 17:25:23.725006	CADASTRAR_BIOMETRIA	ERRO	Falha: Já existe um cadastro em andamento	2025-11-10 17:25:23.725006	2025-11-10 00:00:00	11111	Salgado
365	45	2025-11-10 17:25:23.741163	CADASTRAR_BIOMETRIA	ERRO	Falha: Erro no cadastro: Já existe um cadastro em andamento	2025-11-10 17:25:23.741163	2025-11-10 00:00:00	11111	Salgado
366	45	2025-11-10 17:25:24.011532	CADASTRAR_BIOMETRIA	ERRO	Falha: Já existe um cadastro em andamento	2025-11-10 17:25:24.011532	2025-11-10 00:00:00	11111	Salgado
367	45	2025-11-10 17:25:24.033063	CADASTRAR_BIOMETRIA	ERRO	Falha: Erro no cadastro: Já existe um cadastro em andamento	2025-11-10 17:25:24.033063	2025-11-10 00:00:00	11111	Salgado
368	45	2025-11-10 17:25:24.548172	CADASTRAR_BIOMETRIA	ERRO	Falha: Já existe um cadastro em andamento	2025-11-10 17:25:24.548172	2025-11-10 00:00:00	11111	Salgado
369	45	2025-11-10 17:25:24.566551	CADASTRAR_BIOMETRIA	ERRO	Falha: Erro no cadastro: Já existe um cadastro em andamento	2025-11-10 17:25:24.566551	2025-11-10 00:00:00	11111	Salgado
370	45	2025-11-10 17:25:24.771292	CADASTRAR_BIOMETRIA	ERRO	Falha: Já existe um cadastro em andamento	2025-11-10 17:25:24.771292	2025-11-10 00:00:00	11111	Salgado
371	45	2025-11-10 17:25:24.817032	CADASTRAR_BIOMETRIA	ERRO	Falha: Erro no cadastro: Já existe um cadastro em andamento	2025-11-10 17:25:24.817032	2025-11-10 00:00:00	11111	Salgado
372	45	2025-11-10 17:25:24.97976	CADASTRAR_BIOMETRIA	ERRO	Falha: Já existe um cadastro em andamento	2025-11-10 17:25:24.97976	2025-11-10 00:00:00	11111	Salgado
373	45	2025-11-10 17:25:25.001542	CADASTRAR_BIOMETRIA	ERRO	Falha: Erro no cadastro: Já existe um cadastro em andamento	2025-11-10 17:25:25.001542	2025-11-10 00:00:00	11111	Salgado
374	45	2025-11-10 17:25:25.042148	CADASTRAR_BIOMETRIA	ERRO	Falha: Erro no cadastro: The received packet do not begin with a valid header!	2025-11-10 17:25:25.042148	2025-11-10 00:00:00	11111	Salgado
375	45	2025-11-10 17:25:48.845847	CADASTRAR_BIOMETRIA	ERRO	Falha: fetch failed	2025-11-10 17:25:48.845847	2025-11-10 00:00:00	11111	Salgado
376	68	2025-11-10 17:32:22.34947	CADASTRAR_BIOMETRIA	ERRO	Falha: Digital já cadastrada na posição 1	2025-11-10 17:32:22.34947	2025-11-10 00:00:00	156321489	Bozelli
377	68	2025-11-10 17:32:22.399494	CADASTRAR_BIOMETRIA	ERRO	Falha: Erro no cadastro: Digital já cadastrada na posição 1	2025-11-10 17:32:22.399494	2025-11-10 00:00:00	156321489	Bozelli
378	68	2025-11-10 17:32:43.381655	CADASTRAR_BIOMETRIA	SUCESSO	Biometria cadastrada na posição undefined	2025-11-10 17:32:43.381655	2025-11-10 00:00:00	156321489	Bozelli
379	68	2025-11-10 17:34:13.60481	EXCLUSAO_USUARIO	SUCESSO	Usuário "Bozelli" (tipo=VISITANTE) excluído com sucesso	2025-11-10 17:34:13.60481	2025-11-10 00:00:00	156321489	Bozelli
380	71	2025-11-10 17:34:26.604385	CRIAR_USUARIO	SUCESSO	Usuário FUNCIONARIO criado	2025-11-10 17:34:26.604385	2025-11-10 00:00:00	25632	LALA
381	71	2025-11-10 17:34:26.626454	CRIAR_USUARIO	SUCESSO	FUNCIONARIO LALA cadastrado sem biometria	2025-11-10 17:34:26.626454	2025-11-10 00:00:00	25632	LALA
382	71	2025-11-10 17:34:33.83675	CADASTRAR_BIOMETRIA	ERRO	Falha: Erro no cadastro: device reports readiness to read but returned no data (device disconnected or multiple access on port?)	2025-11-10 17:34:33.83675	2025-11-10 00:00:00	25632	LALA
383	71	2025-11-10 17:34:33.889943	CADASTRAR_BIOMETRIA	ERRO	Falha: Erro no cadastro: Erro no cadastro: device reports readiness to read but returned no data (device disconnected or multiple access on port?)	2025-11-10 17:34:33.889943	2025-11-10 00:00:00	25632	LALA
384	71	2025-11-10 17:35:09.209987	CADASTRAR_BIOMETRIA	ERRO	Falha: Timeout - falha ao detectar dedo na primeira leitura	2025-11-10 17:35:09.209987	2025-11-10 00:00:00	25632	LALA
385	71	2025-11-10 17:36:32.692106	CADASTRAR_BIOMETRIA	SUCESSO	Biometria cadastrada na posição undefined	2025-11-10 17:36:32.692106	2025-11-10 00:00:00	25632	LALA
386	66	2025-11-10 17:40:57.900476	CADASTRAR_BIOMETRIA	ERRO	Falha: Timeout - falha ao detectar dedo na primeira leitura	2025-11-10 17:40:57.900476	2025-11-10 00:00:00	591374387	Allan
387	61	2025-11-10 17:49:47.953467	CADASTRAR_BIOMETRIA	SUCESSO	Biometria cadastrada na posição undefined	2025-11-10 17:49:47.953467	2025-11-10 00:00:00	7894561237894	Gabriel Advogado
388	41	2025-11-10 17:55:09.613559	CADASTRAR_BIOMETRIA	ERRO	Falha: Já existe um cadastro em andamento	2025-11-10 17:55:09.613559	2025-11-10 00:00:00	56645	Gabriel San
389	41	2025-11-10 17:55:09.634958	CADASTRAR_BIOMETRIA	ERRO	Falha: Erro no cadastro: Já existe um cadastro em andamento	2025-11-10 17:55:09.634958	2025-11-10 00:00:00	56645	Gabriel San
390	41	2025-11-10 17:55:10.563644	CADASTRAR_BIOMETRIA	ERRO	Falha: Já existe um cadastro em andamento	2025-11-10 17:55:10.563644	2025-11-10 00:00:00	56645	Gabriel San
391	41	2025-11-10 17:55:10.588975	CADASTRAR_BIOMETRIA	ERRO	Falha: Erro no cadastro: Já existe um cadastro em andamento	2025-11-10 17:55:10.588975	2025-11-10 00:00:00	56645	Gabriel San
392	41	2025-11-10 17:55:23.182244	CADASTRAR_BIOMETRIA	ERRO	Falha: Timeout - falha ao detectar dedo na segunda leitura	2025-11-10 17:55:23.182244	2025-11-10 00:00:00	56645	Gabriel San
393	62	2025-11-10 17:55:42.66871	CADASTRAR_BIOMETRIA	ERRO	Falha: Digital já cadastrada na posição 4	2025-11-10 17:55:42.66871	2025-11-10 00:00:00	47863	Gabrielsss
394	62	2025-11-10 17:55:42.694597	CADASTRAR_BIOMETRIA	ERRO	Falha: Erro no cadastro: Digital já cadastrada na posição 4	2025-11-10 17:55:42.694597	2025-11-10 00:00:00	47863	Gabrielsss
395	62	2025-11-10 17:55:55.846615	CADASTRAR_BIOMETRIA	ERRO	Falha: Digital já cadastrada na posição 4	2025-11-10 17:55:55.846615	2025-11-10 00:00:00	47863	Gabrielsss
396	62	2025-11-10 17:55:55.866957	CADASTRAR_BIOMETRIA	ERRO	Falha: Erro no cadastro: Digital já cadastrada na posição 4	2025-11-10 17:55:55.866957	2025-11-10 00:00:00	47863	Gabrielsss
397	62	2025-11-10 17:56:33.296445	CADASTRAR_BIOMETRIA	ERRO	Falha: Digital já cadastrada na posição 5	2025-11-10 17:56:33.296445	2025-11-10 00:00:00	47863	Gabrielsss
398	62	2025-11-10 17:56:33.33992	CADASTRAR_BIOMETRIA	ERRO	Falha: Erro no cadastro: Digital já cadastrada na posição 5	2025-11-10 17:56:33.33992	2025-11-10 00:00:00	47863	Gabrielsss
399	62	2025-11-10 18:01:23.273504	CADASTRAR_BIOMETRIA	ERRO	Falha: Timeout - falha ao detectar dedo na primeira leitura	2025-11-10 18:01:23.273504	2025-11-10 00:00:00	47863	Gabrielsss
400	71	2025-11-10 18:01:45.181011	EXCLUSAO_USUARIO	SUCESSO	Usuário "LALA" (tipo=FUNCIONARIO) excluído com sucesso	2025-11-10 18:01:45.181011	2025-11-10 00:00:00	25632	LALA
401	72	2025-11-10 18:01:57.988956	CRIAR_USUARIO	SUCESSO	Usuário FUNCIONARIO criado	2025-11-10 18:01:57.988956	2025-11-10 00:00:00	54236	LALALENDI
402	72	2025-11-10 18:01:58.013147	CRIAR_USUARIO	SUCESSO	FUNCIONARIO LALALENDI cadastrado sem biometria	2025-11-10 18:01:58.013147	2025-11-10 00:00:00	54236	LALALENDI
403	72	2025-11-10 18:02:11.448009	CADASTRAR_BIOMETRIA	ERRO	Falha: fetch failed	2025-11-10 18:02:11.448009	2025-11-10 00:00:00	54236	LALALENDI
404	72	2025-11-10 18:02:11.486923	CADASTRAR_BIOMETRIA	ERRO	Falha: Erro no cadastro: fetch failed	2025-11-10 18:02:11.486923	2025-11-10 00:00:00	54236	LALALENDI
405	66	2025-11-10 18:04:53.987625	CADASTRAR_BIOMETRIA	ERRO	Falha: Erro no cadastro: device reports readiness to read but returned no data (device disconnected or multiple access on port?)	2025-11-10 18:04:53.987625	2025-11-10 00:00:00	591374387	Allan
493	41	2025-11-19 16:52:18.571901	INICIAR_CADASTRO_BIOMETRIA	ERRO	Falha: fetch failed	2025-11-19 16:52:18.571901	2025-11-19 00:00:00	56645	Gabriel San
406	66	2025-11-10 18:04:54.03401	CADASTRAR_BIOMETRIA	ERRO	Falha: Erro no cadastro: Erro no cadastro: device reports readiness to read but returned no data (device disconnected or multiple access on port?)	2025-11-10 18:04:54.03401	2025-11-10 00:00:00	591374387	Allan
407	66	2025-11-10 18:05:00.187777	CADASTRAR_BIOMETRIA	ERRO	Falha: Erro no cadastro: device reports readiness to read but returned no data (device disconnected or multiple access on port?)	2025-11-10 18:05:00.187777	2025-11-10 00:00:00	591374387	Allan
408	66	2025-11-10 18:05:00.229408	CADASTRAR_BIOMETRIA	ERRO	Falha: Erro no cadastro: Erro no cadastro: device reports readiness to read but returned no data (device disconnected or multiple access on port?)	2025-11-10 18:05:00.229408	2025-11-10 00:00:00	591374387	Allan
409	66	2025-11-10 18:05:12.991154	CADASTRAR_BIOMETRIA	SUCESSO	Biometria cadastrada na posição undefined	2025-11-10 18:05:12.991154	2025-11-10 00:00:00	591374387	Allan
410	60	2025-11-13 18:10:46.609439	INICIAR_CADASTRO_BIOMETRIA	ERRO	Falha: Catraca retornou status: 404	2025-11-13 18:10:46.609439	2025-11-13 00:00:00	45632	Alegre
411	60	2025-11-13 18:10:46.643695	CADASTRAR_BIOMETRIA	ERRO	Falha: Erro ao iniciar cadastro: Catraca retornou status: 404	2025-11-13 18:10:46.643695	2025-11-13 00:00:00	45632	Alegre
412	60	2025-11-13 18:13:17.182208	INICIAR_CADASTRO_BIOMETRIA	INICIADO	Cadastro biométrico iniciado - Sessão: session_60_1763068396957	2025-11-13 18:13:17.182208	2025-11-13 00:00:00	45632	Alegre
413	60	2025-11-13 18:14:49.76931	INICIAR_CADASTRO_BIOMETRIA	INICIADO	Cadastro biométrico iniciado - Sessão: session_60_1763068489551	2025-11-13 18:14:49.76931	2025-11-13 00:00:00	45632	Alegre
414	60	2025-11-13 18:17:56.449543	INICIAR_CADASTRO_BIOMETRIA	INICIADO	Cadastro biométrico iniciado - Sessão: session_60_1763068676232	2025-11-13 18:17:56.449543	2025-11-13 00:00:00	45632	Alegre
415	60	2025-11-13 18:20:17.889624	INICIAR_CADASTRO_BIOMETRIA	INICIADO	Cadastro biométrico iniciado - Sessão: session_60_1763068817685	2025-11-13 18:20:17.889624	2025-11-13 00:00:00	45632	Alegre
416	60	2025-11-13 18:21:42.544748	INICIAR_CADASTRO_BIOMETRIA	INICIADO	Cadastro biométrico iniciado - Sessão: session_60_1763068901928	2025-11-13 18:21:42.544748	2025-11-13 00:00:00	45632	Alegre
417	60	2025-11-13 18:25:40.711117	INICIAR_CADASTRO_BIOMETRIA	INICIADO	Cadastro biométrico iniciado - Sessão: session_60_1763069140501	2025-11-13 18:25:40.711117	2025-11-13 00:00:00	45632	Alegre
418	60	2025-11-13 18:32:12.951697	INICIAR_CADASTRO_BIOMETRIA	INICIADO	Cadastro biométrico iniciado - Sessão: session_60_1763069532713	2025-11-13 18:32:12.951697	2025-11-13 00:00:00	45632	Alegre
419	60	2025-11-13 18:33:24.383082	INICIAR_CADASTRO_BIOMETRIA	INICIADO	Cadastro biométrico iniciado - Sessão: session_60_1763069604170	2025-11-13 18:33:24.383082	2025-11-13 00:00:00	45632	Alegre
420	60	2025-11-13 18:36:54.567226	INICIAR_CADASTRO_BIOMETRIA	INICIADO	Cadastro biométrico iniciado - Sessão: session_60_1763069814349	2025-11-13 18:36:54.567226	2025-11-13 00:00:00	45632	Alegre
421	60	2025-11-13 18:55:02.188307	INICIAR_CADASTRO_BIOMETRIA	INICIADO	Cadastro biométrico iniciado - Sessão: session_60_1763070901930	2025-11-13 18:55:02.188307	2025-11-13 00:00:00	45632	Alegre
422	60	2025-11-13 18:59:55.922447	INICIAR_CADASTRO_BIOMETRIA	INICIADO	Cadastro biométrico iniciado - Sessão: session_60_1763071195695	2025-11-13 18:59:55.922447	2025-11-13 00:00:00	45632	Alegre
423	60	2025-11-14 09:37:08.758132	INICIAR_CADASTRO_BIOMETRIA	INICIADO	Cadastro biométrico iniciado - Sessão: session_60_1763123828689	2025-11-14 09:37:08.758132	2025-11-14 00:00:00	45632	Alegre
424	60	2025-11-14 09:38:08.079949	INICIAR_CADASTRO_BIOMETRIA	INICIADO	Cadastro biométrico iniciado - Sessão: session_60_1763123888002	2025-11-14 09:38:08.079949	2025-11-14 00:00:00	45632	Alegre
425	60	2025-11-14 09:39:21.881223	INICIAR_CADASTRO_BIOMETRIA	INICIADO	Cadastro biométrico iniciado - Sessão: session_60_1763123961804	2025-11-14 09:39:21.881223	2025-11-14 00:00:00	45632	Alegre
426	60	2025-11-14 09:40:10.638174	INICIAR_CADASTRO_BIOMETRIA	INICIADO	Cadastro biométrico iniciado - Sessão: session_60_1763124010541	2025-11-14 09:40:10.638174	2025-11-14 00:00:00	45632	Alegre
427	60	2025-11-14 09:40:40.263402	INICIAR_CADASTRO_BIOMETRIA	INICIADO	Cadastro biométrico iniciado - Sessão: session_60_1763124040185	2025-11-14 09:40:40.263402	2025-11-14 00:00:00	45632	Alegre
428	60	2025-11-14 09:41:28.793086	INICIAR_CADASTRO_BIOMETRIA	INICIADO	Cadastro biométrico iniciado - Sessão: session_60_1763124088715	2025-11-14 09:41:28.793086	2025-11-14 00:00:00	45632	Alegre
429	60	2025-11-14 09:52:56.510784	INICIAR_CADASTRO_BIOMETRIA	INICIADO	Cadastro biométrico iniciado - Sessão: session_60_1763124776445	2025-11-14 09:52:56.510784	2025-11-14 00:00:00	45632	Alegre
430	1	2025-11-14 10:27:24.288333	INICIAR_CADASTRO_BIOMETRIA	INICIADO	Cadastro biométrico iniciado - Sessão: session_1_1763126844223	2025-11-14 10:27:24.288333	2025-11-14 00:00:00	teste_001	Administrador Sistema
431	66	2025-11-14 10:30:26.3737	INICIAR_CADASTRO_BIOMETRIA	INICIADO	Cadastro biométrico iniciado - Sessão: session_66_1763127026265	2025-11-14 10:30:26.3737	2025-11-14 00:00:00	591374387	Allan
432	66	2025-11-14 10:32:28.563509	INICIAR_CADASTRO_BIOMETRIA	INICIADO	Cadastro biométrico iniciado - Sessão: session_66_1763127148440	2025-11-14 10:32:28.563509	2025-11-14 00:00:00	591374387	Allan
433	66	2025-11-14 11:03:03.726045	INICIAR_CADASTRO_BIOMETRIA	INICIADO	Cadastro biométrico iniciado - Sessão: session_66_1763128983643	2025-11-14 11:03:03.726045	2025-11-14 00:00:00	591374387	Allan
434	66	2025-11-14 11:03:26.812111	INICIAR_CADASTRO_BIOMETRIA	INICIADO	Cadastro biométrico iniciado - Sessão: session_66_1763129006744	2025-11-14 11:03:26.812111	2025-11-14 00:00:00	591374387	Allan
435	66	2025-11-14 11:04:03.945269	INICIAR_CADASTRO_BIOMETRIA	INICIADO	Cadastro biométrico iniciado - Sessão: session_66_1763129043876	2025-11-14 11:04:03.945269	2025-11-14 00:00:00	591374387	Allan
436	66	2025-11-14 11:04:21.376156	INICIAR_CADASTRO_BIOMETRIA	INICIADO	Cadastro biométrico iniciado - Sessão: session_66_1763129061280	2025-11-14 11:04:21.376156	2025-11-14 00:00:00	591374387	Allan
437	61	2025-11-14 11:06:05.458857	INICIAR_CADASTRO_BIOMETRIA	INICIADO	Cadastro biométrico iniciado - Sessão: session_61_1763129165381	2025-11-14 11:06:05.458857	2025-11-14 00:00:00	7894561237894	Gabriel Advogado
438	73	2025-11-14 11:08:01.30227	CRIAR_USUARIO	SUCESSO	Usuário FUNCIONARIO criado	2025-11-14 11:08:01.30227	2025-11-14 00:00:00	52689	Marcelo
439	73	2025-11-14 11:08:01.35829	CRIAR_USUARIO	SUCESSO	FUNCIONARIO Marcelo cadastrado sem biometria	2025-11-14 11:08:01.35829	2025-11-14 00:00:00	52689	Marcelo
440	73	2025-11-14 11:08:03.95607	INICIAR_CADASTRO_BIOMETRIA	INICIADO	Cadastro biométrico iniciado - Sessão: session_73_1763129283893	2025-11-14 11:08:03.95607	2025-11-14 00:00:00	52689	Marcelo
441	73	2025-11-14 11:08:11.869704	CADASTRAR_BIOMETRIA	ERRO	Falha no cadastro da biometria	2025-11-14 11:08:11.869704	2025-11-14 00:00:00	52689	Marcelo
442	73	2025-11-14 11:08:22.675229	INICIAR_CADASTRO_BIOMETRIA	INICIADO	Cadastro biométrico iniciado - Sessão: session_73_1763129302574	2025-11-14 11:08:22.675229	2025-11-14 00:00:00	52689	Marcelo
443	73	2025-11-14 11:08:45.429232	CADASTRAR_BIOMETRIA	SUCESSO	Biometria cadastrada com sucesso! Posição: N/A	2025-11-14 11:08:45.429232	2025-11-14 00:00:00	52689	Marcelo
444	74	2025-11-14 14:09:08.911951	CRIAR_USUARIO	SUCESSO	Usuário FUNCIONARIO criado	2025-11-14 14:09:08.911951	2025-11-14 00:00:00	14563	André
445	74	2025-11-14 14:09:09.078395	CRIAR_USUARIO	SUCESSO	FUNCIONARIO André cadastrado sem biometria	2025-11-14 14:09:09.078395	2025-11-14 00:00:00	14563	André
446	74	2025-11-14 14:09:11.795248	INICIAR_CADASTRO_BIOMETRIA	INICIADO	Cadastro biométrico iniciado - Sessão: session_74_1763140151681	2025-11-14 14:09:11.795248	2025-11-14 00:00:00	14563	André
447	74	2025-11-14 14:09:46.323894	CADASTRAR_BIOMETRIA	SUCESSO	Biometria cadastrada com sucesso! Posição: N/A	2025-11-14 14:09:46.323894	2025-11-14 00:00:00	14563	André
448	60	2025-11-19 15:42:18.148768	INICIAR_CADASTRO_BIOMETRIA	INICIADO	Cadastro biométrico iniciado - Sessão: session_60_1763577736977	2025-11-19 15:42:18.148768	2025-11-19 00:00:00	45632	Alegre
494	41	2025-11-19 16:52:18.601104	CADASTRAR_BIOMETRIA	ERRO	Falha: Erro ao iniciar cadastro: fetch failed	2025-11-19 16:52:18.601104	2025-11-19 00:00:00	56645	Gabriel San
449	60	2025-11-19 15:43:56.285448	INICIAR_CADASTRO_BIOMETRIA	INICIADO	Cadastro biométrico iniciado - Sessão: session_60_1763577835121	2025-11-19 15:43:56.285448	2025-11-19 00:00:00	45632	Alegre
450	60	2025-11-19 15:46:11.775817	INICIAR_CADASTRO_BIOMETRIA	INICIADO	Cadastro biométrico iniciado - Sessão: session_60_1763577970613	2025-11-19 15:46:11.775817	2025-11-19 00:00:00	45632	Alegre
451	60	2025-11-19 15:46:37.166154	INICIAR_CADASTRO_BIOMETRIA	INICIADO	Cadastro biométrico iniciado - Sessão: session_60_1763577996024	2025-11-19 15:46:37.166154	2025-11-19 00:00:00	45632	Alegre
452	60	2025-11-19 15:50:03.269701	INICIAR_CADASTRO_BIOMETRIA	INICIADO	Cadastro biométrico iniciado - Sessão: session_60_1763578202080	2025-11-19 15:50:03.269701	2025-11-19 00:00:00	45632	Alegre
453	66	2025-11-19 15:51:57.262195	INICIAR_CADASTRO_BIOMETRIA	INICIADO	Cadastro biométrico iniciado - Sessão: session_66_1763578316092	2025-11-19 15:51:57.262195	2025-11-19 00:00:00	591374387	Allan
454	66	2025-11-19 15:57:23.169833	INICIAR_CADASTRO_BIOMETRIA	INICIADO	Cadastro biométrico iniciado - Sessão: session_66_1763578642000	2025-11-19 15:57:23.169833	2025-11-19 00:00:00	591374387	Allan
455	66	2025-11-19 15:58:09.593556	INICIAR_CADASTRO_BIOMETRIA	INICIADO	Cadastro biométrico iniciado - Sessão: session_66_1763578688441	2025-11-19 15:58:09.593556	2025-11-19 00:00:00	591374387	Allan
456	66	2025-11-19 16:03:32.201583	INICIAR_CADASTRO_BIOMETRIA	INICIADO	Cadastro biométrico iniciado - Sessão: session_66_1763579010984	2025-11-19 16:03:32.201583	2025-11-19 00:00:00	591374387	Allan
457	60	2025-11-19 16:25:22.258157	INICIAR_CADASTRO_BIOMETRIA	INICIADO	Cadastro biométrico iniciado - Sessão: session_60_1763580321048	2025-11-19 16:25:22.258157	2025-11-19 00:00:00	45632	Alegre
458	60	2025-11-19 16:26:24.602454	INICIAR_CADASTRO_BIOMETRIA	INICIADO	Cadastro biométrico iniciado - Sessão: session_60_1763580383440	2025-11-19 16:26:24.602454	2025-11-19 00:00:00	45632	Alegre
459	60	2025-11-19 16:27:53.696655	INICIAR_CADASTRO_BIOMETRIA	INICIADO	Cadastro biométrico iniciado - Sessão: session_60_1763580472532	2025-11-19 16:27:53.696655	2025-11-19 00:00:00	45632	Alegre
460	66	2025-11-19 16:31:42.932823	INICIAR_CADASTRO_BIOMETRIA	INICIADO	Cadastro biométrico iniciado - Sessão: session_66_1763580701748	2025-11-19 16:31:42.932823	2025-11-19 00:00:00	591374387	Allan
461	74	2025-11-19 16:36:05.106943	INICIAR_CADASTRO_BIOMETRIA	INICIADO	Cadastro biométrico iniciado - Sessão: session_74_1763580963919	2025-11-19 16:36:05.106943	2025-11-19 00:00:00	14563	André
462	61	2025-11-19 16:47:41.482411	INICIAR_CADASTRO_BIOMETRIA	INICIADO	Cadastro biométrico iniciado - Sessão: session_61_1763581660319	2025-11-19 16:47:41.482411	2025-11-19 00:00:00	7894561237894	Gabriel Advogado
463	41	2025-11-19 16:48:49.726249	INICIAR_CADASTRO_BIOMETRIA	INICIADO	Cadastro biométrico iniciado - Sessão: session_41_1763581728531	2025-11-19 16:48:49.726249	2025-11-19 00:00:00	56645	Gabriel San
464	41	2025-11-19 16:51:54.151734	INICIAR_CADASTRO_BIOMETRIA	INICIADO	Cadastro biométrico iniciado - Sessão: session_41_1763581912992	2025-11-19 16:51:54.151734	2025-11-19 00:00:00	56645	Gabriel San
465	41	2025-11-19 16:52:00.37652	INICIAR_CADASTRO_BIOMETRIA	ERRO	Falha: Já existe um cadastro em andamento	2025-11-19 16:52:00.37652	2025-11-19 00:00:00	56645	Gabriel San
466	41	2025-11-19 16:52:00.709573	CADASTRAR_BIOMETRIA	ERRO	Falha: Erro ao iniciar cadastro: Já existe um cadastro em andamento	2025-11-19 16:52:00.709573	2025-11-19 00:00:00	56645	Gabriel San
467	41	2025-11-19 16:52:02.70477	INICIAR_CADASTRO_BIOMETRIA	ERRO	Falha: Já existe um cadastro em andamento	2025-11-19 16:52:02.70477	2025-11-19 00:00:00	56645	Gabriel San
468	41	2025-11-19 16:52:02.728096	CADASTRAR_BIOMETRIA	ERRO	Falha: Erro ao iniciar cadastro: Já existe um cadastro em andamento	2025-11-19 16:52:02.728096	2025-11-19 00:00:00	56645	Gabriel San
469	41	2025-11-19 16:52:12.976292	INICIAR_CADASTRO_BIOMETRIA	ERRO	Falha: Já existe um cadastro em andamento	2025-11-19 16:52:12.976292	2025-11-19 00:00:00	56645	Gabriel San
470	41	2025-11-19 16:52:13.02027	CADASTRAR_BIOMETRIA	ERRO	Falha: Erro ao iniciar cadastro: Já existe um cadastro em andamento	2025-11-19 16:52:13.02027	2025-11-19 00:00:00	56645	Gabriel San
471	41	2025-11-19 16:52:14.178614	INICIAR_CADASTRO_BIOMETRIA	ERRO	Falha: Já existe um cadastro em andamento	2025-11-19 16:52:14.178614	2025-11-19 00:00:00	56645	Gabriel San
472	41	2025-11-19 16:52:14.219649	CADASTRAR_BIOMETRIA	ERRO	Falha: Erro ao iniciar cadastro: Já existe um cadastro em andamento	2025-11-19 16:52:14.219649	2025-11-19 00:00:00	56645	Gabriel San
473	41	2025-11-19 16:52:14.851782	INICIAR_CADASTRO_BIOMETRIA	ERRO	Falha: Já existe um cadastro em andamento	2025-11-19 16:52:14.851782	2025-11-19 00:00:00	56645	Gabriel San
474	41	2025-11-19 16:52:14.873301	CADASTRAR_BIOMETRIA	ERRO	Falha: Erro ao iniciar cadastro: Já existe um cadastro em andamento	2025-11-19 16:52:14.873301	2025-11-19 00:00:00	56645	Gabriel San
475	41	2025-11-19 16:52:16.081419	INICIAR_CADASTRO_BIOMETRIA	ERRO	Falha: Já existe um cadastro em andamento	2025-11-19 16:52:16.081419	2025-11-19 00:00:00	56645	Gabriel San
476	41	2025-11-19 16:52:16.110305	CADASTRAR_BIOMETRIA	ERRO	Falha: Erro ao iniciar cadastro: Já existe um cadastro em andamento	2025-11-19 16:52:16.110305	2025-11-19 00:00:00	56645	Gabriel San
477	41	2025-11-19 16:52:16.263493	INICIAR_CADASTRO_BIOMETRIA	ERRO	Falha: Já existe um cadastro em andamento	2025-11-19 16:52:16.263493	2025-11-19 00:00:00	56645	Gabriel San
478	41	2025-11-19 16:52:16.287589	CADASTRAR_BIOMETRIA	ERRO	Falha: Erro ao iniciar cadastro: Já existe um cadastro em andamento	2025-11-19 16:52:16.287589	2025-11-19 00:00:00	56645	Gabriel San
479	41	2025-11-19 16:52:16.584653	INICIAR_CADASTRO_BIOMETRIA	ERRO	Falha: Já existe um cadastro em andamento	2025-11-19 16:52:16.584653	2025-11-19 00:00:00	56645	Gabriel San
480	41	2025-11-19 16:52:16.624461	CADASTRAR_BIOMETRIA	ERRO	Falha: Erro ao iniciar cadastro: Já existe um cadastro em andamento	2025-11-19 16:52:16.624461	2025-11-19 00:00:00	56645	Gabriel San
481	41	2025-11-19 16:52:16.940466	INICIAR_CADASTRO_BIOMETRIA	ERRO	Falha: Já existe um cadastro em andamento	2025-11-19 16:52:16.940466	2025-11-19 00:00:00	56645	Gabriel San
482	41	2025-11-19 16:52:16.963148	CADASTRAR_BIOMETRIA	ERRO	Falha: Erro ao iniciar cadastro: Já existe um cadastro em andamento	2025-11-19 16:52:16.963148	2025-11-19 00:00:00	56645	Gabriel San
483	41	2025-11-19 16:52:17.316333	INICIAR_CADASTRO_BIOMETRIA	ERRO	Falha: Já existe um cadastro em andamento	2025-11-19 16:52:17.316333	2025-11-19 00:00:00	56645	Gabriel San
484	41	2025-11-19 16:52:17.388658	CADASTRAR_BIOMETRIA	ERRO	Falha: Erro ao iniciar cadastro: Já existe um cadastro em andamento	2025-11-19 16:52:17.388658	2025-11-19 00:00:00	56645	Gabriel San
485	41	2025-11-19 16:52:17.673059	INICIAR_CADASTRO_BIOMETRIA	ERRO	Falha: Já existe um cadastro em andamento	2025-11-19 16:52:17.673059	2025-11-19 00:00:00	56645	Gabriel San
486	41	2025-11-19 16:52:17.707623	CADASTRAR_BIOMETRIA	ERRO	Falha: Erro ao iniciar cadastro: Já existe um cadastro em andamento	2025-11-19 16:52:17.707623	2025-11-19 00:00:00	56645	Gabriel San
487	41	2025-11-19 16:52:18.028354	INICIAR_CADASTRO_BIOMETRIA	ERRO	Falha: Já existe um cadastro em andamento	2025-11-19 16:52:18.028354	2025-11-19 00:00:00	56645	Gabriel San
488	41	2025-11-19 16:52:18.0498	CADASTRAR_BIOMETRIA	ERRO	Falha: Erro ao iniciar cadastro: Já existe um cadastro em andamento	2025-11-19 16:52:18.0498	2025-11-19 00:00:00	56645	Gabriel San
489	41	2025-11-19 16:52:18.228941	INICIAR_CADASTRO_BIOMETRIA	ERRO	Falha: Já existe um cadastro em andamento	2025-11-19 16:52:18.228941	2025-11-19 00:00:00	56645	Gabriel San
490	41	2025-11-19 16:52:18.256932	CADASTRAR_BIOMETRIA	ERRO	Falha: Erro ao iniciar cadastro: Já existe um cadastro em andamento	2025-11-19 16:52:18.256932	2025-11-19 00:00:00	56645	Gabriel San
491	41	2025-11-19 16:52:18.438989	INICIAR_CADASTRO_BIOMETRIA	ERRO	Falha: Já existe um cadastro em andamento	2025-11-19 16:52:18.438989	2025-11-19 00:00:00	56645	Gabriel San
492	41	2025-11-19 16:52:18.456807	CADASTRAR_BIOMETRIA	ERRO	Falha: Erro ao iniciar cadastro: Já existe um cadastro em andamento	2025-11-19 16:52:18.456807	2025-11-19 00:00:00	56645	Gabriel San
495	41	2025-11-19 16:59:01.249274	INICIAR_CADASTRO_BIOMETRIA	INICIADO	Cadastro biométrico iniciado - Sessão: session_41_1763582340052	2025-11-19 16:59:01.249274	2025-11-19 00:00:00	56645	Gabriel San
496	62	2025-11-19 17:02:22.345306	INICIAR_CADASTRO_BIOMETRIA	INICIADO	Cadastro biométrico iniciado - Sessão: session_62_1763582541184	2025-11-19 17:02:22.345306	2025-11-19 00:00:00	47863	Gabrielsss
497	60	2025-11-19 17:03:25.008698	INICIAR_CADASTRO_BIOMETRIA	INICIADO	Cadastro biométrico iniciado - Sessão: session_60_1763582603845	2025-11-19 17:03:25.008698	2025-11-19 00:00:00	45632	Alegre
498	60	2025-11-19 17:04:12.545207	INICIAR_CADASTRO_BIOMETRIA	INICIADO	Cadastro biométrico iniciado - Sessão: session_60_1763582651380	2025-11-19 17:04:12.545207	2025-11-19 00:00:00	45632	Alegre
499	66	2025-11-19 17:06:00.295523	INICIAR_CADASTRO_BIOMETRIA	INICIADO	Cadastro biométrico iniciado - Sessão: session_66_1763582759136	2025-11-19 17:06:00.295523	2025-11-19 00:00:00	591374387	Allan
500	66	2025-11-19 17:06:28.292819	INICIAR_CADASTRO_BIOMETRIA	INICIADO	Cadastro biométrico iniciado - Sessão: session_66_1763582787137	2025-11-19 17:06:28.292819	2025-11-19 00:00:00	591374387	Allan
501	74	2025-11-19 17:31:14.431644	INICIAR_CADASTRO_BIOMETRIA	INICIADO	Cadastro biométrico iniciado - Sessão: session_74_1763584273219	2025-11-19 17:31:14.431644	2025-11-19 00:00:00	14563	André
502	74	2025-11-19 17:31:37.34171	INICIAR_CADASTRO_BIOMETRIA	INICIADO	Cadastro biométrico iniciado - Sessão: session_74_1763584296065	2025-11-19 17:31:37.34171	2025-11-19 00:00:00	14563	André
503	74	2025-11-19 17:32:07.450892	INICIAR_CADASTRO_BIOMETRIA	INICIADO	Cadastro biométrico iniciado - Sessão: session_74_1763584326285	2025-11-19 17:32:07.450892	2025-11-19 00:00:00	14563	André
\.


--
-- Data for Name: log_entrada; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.log_entrada (id, usuario_id, nome, tipo, periodo, created_at, controle, horario, data_entrada, identificador, updated_at) FROM stdin;
15	1	Rafael	ESTUDANTE	TARDE	2025-09-03 19:24:34.702161	f	19:24:34.702161	2025-09-03	\N	2025-10-30 18:24:45.818716
16	1	Rafael	ESTUDANTE	TARDE	2025-09-03 19:24:52.030783	t	19:24:52.030783	2025-09-03	\N	2025-10-30 18:24:45.818716
19	1	Rafael	ESTUDANTE	TARDE	2025-09-04 17:44:13.696736	f	17:44:13.696736	2025-09-04	\N	2025-10-30 18:24:45.818716
20	1	Rafael	ESTUDANTE	TARDE	2025-09-04 17:44:22.47636	t	17:44:22.47636	2025-09-04	\N	2025-10-30 18:24:45.818716
21	1	Rafael	ESTUDANTE	TARDE	2025-09-04 17:44:31.135432	f	17:44:31.135432	2025-09-04	\N	2025-10-30 18:24:45.818716
22	1	Rafael	ESTUDANTE	TARDE	2025-09-04 17:44:40.829725	t	17:44:40.829725	2025-09-04	\N	2025-10-30 18:24:45.818716
23	1	Rafael	ESTUDANTE	TARDE	2025-09-04 17:44:49.685552	f	17:44:49.685552	2025-09-04	\N	2025-10-30 18:24:45.818716
24	1	Rafael	ESTUDANTE	TARDE	2025-09-04 17:44:57.496397	t	17:44:57.496397	2025-09-04	\N	2025-10-30 18:24:45.818716
25	1	Rafael	ESTUDANTE	TARDE	2025-09-04 17:45:50.955923	f	17:45:50.955923	2025-09-04	\N	2025-10-30 18:24:45.818716
26	1	Rafael	ESTUDANTE	TARDE	2025-09-04 17:46:09.245324	t	17:46:09.245324	2025-09-04	\N	2025-10-30 18:24:45.818716
27	1	Rafael	ESTUDANTE	TARDE	2025-09-04 17:46:20.355021	f	17:46:20.355021	2025-09-04	\N	2025-10-30 18:24:45.818716
28	1	Rafael	ESTUDANTE	TARDE	2025-09-04 17:46:31.701907	t	17:46:31.701907	2025-09-04	\N	2025-10-30 18:24:45.818716
29	1	Rafael	ESTUDANTE	TARDE	2025-09-04 17:46:46.318522	f	17:46:46.318522	2025-09-04	\N	2025-10-30 18:24:45.818716
30	1	Rafael	ESTUDANTE	TARDE	2025-09-04 17:46:56.623546	t	17:46:56.623546	2025-09-04	\N	2025-10-30 18:24:45.818716
31	1	Rafael	ESTUDANTE	TARDE	2025-09-04 17:47:09.431644	f	17:47:09.431644	2025-09-04	\N	2025-10-30 18:24:45.818716
32	1	Rafael	ESTUDANTE	TARDE	2025-09-04 17:47:28.759017	t	17:47:28.759017	2025-09-04	\N	2025-10-30 18:24:45.818716
33	1	Rafael	ESTUDANTE	TARDE	2025-09-04 17:47:38.761591	f	17:47:38.761591	2025-09-04	\N	2025-10-30 18:24:45.818716
34	1	Rafael	ESTUDANTE	TARDE	2025-09-04 17:47:48.570887	t	17:47:48.570887	2025-09-04	\N	2025-10-30 18:24:45.818716
35	1	Rafael	ESTUDANTE	TARDE	2025-09-04 17:48:00.27485	f	17:48:00.27485	2025-09-04	\N	2025-10-30 18:24:45.818716
36	1	Rafael	ESTUDANTE	TARDE	2025-09-04 17:48:09.417337	t	17:48:09.417337	2025-09-04	\N	2025-10-30 18:24:45.818716
37	1	Rafael	ESTUDANTE	TARDE	2025-09-04 17:48:25.265296	f	17:48:25.265296	2025-09-04	\N	2025-10-30 18:24:45.818716
38	1	Rafael	ESTUDANTE	TARDE	2025-09-04 17:48:34.433766	t	17:48:34.433766	2025-09-04	\N	2025-10-30 18:24:45.818716
39	1	Rafael	ESTUDANTE	TARDE	2025-09-04 17:48:49.918824	f	17:48:49.918824	2025-09-04	\N	2025-10-30 18:24:45.818716
40	1	Rafael	ESTUDANTE	TARDE	2025-09-04 17:49:00.000532	t	17:49:00.000532	2025-09-04	\N	2025-10-30 18:24:45.818716
41	1	Rafael	ESTUDANTE	TARDE	2025-09-04 17:49:12.512645	f	17:49:12.512645	2025-09-04	\N	2025-10-30 18:24:45.818716
42	1	Rafael	ESTUDANTE	TARDE	2025-09-04 17:49:21.743189	t	17:49:21.743189	2025-09-04	\N	2025-10-30 18:24:45.818716
43	1	Rafael	ESTUDANTE	TARDE	2025-09-04 17:49:33.827651	f	17:49:33.827651	2025-09-04	\N	2025-10-30 18:24:45.818716
44	1	Rafael	ESTUDANTE	TARDE	2025-09-11 17:41:33.335599	t	17:41:33.335599	2025-09-11	\N	2025-10-30 18:24:45.818716
47	1	Rafael	ESTUDANTE	TARDE	2025-09-11 18:14:51.412014	f	18:14:51.412014	2025-09-11	\N	2025-10-30 18:24:45.818716
48	1	Rafael	ESTUDANTE	TARDE	2025-09-11 18:15:07.239096	t	18:15:07.239096	2025-09-11	\N	2025-10-30 18:24:45.818716
49	1	Rafael	ESTUDANTE	TARDE	2025-09-11 18:16:08.156229	f	18:16:08.156229	2025-09-11	\N	2025-10-30 18:24:45.818716
50	1	Rafael	ESTUDANTE	TARDE	2025-09-11 16:06:00.249405	t	16:06:00.249405	2025-09-11	\N	2025-10-30 18:24:45.818716
51	1	Rafael	ESTUDANTE	TARDE	2025-09-11 16:06:38.161657	t	16:06:38.161657	2025-09-11	\N	2025-10-30 18:24:45.818716
52	1	Rafael	ESTUDANTE	NOITE	2025-09-11 19:38:35.293379	t	19:38:35.293379	2025-09-11	\N	2025-10-30 18:24:45.818716
53	1	Rafael	ESTUDANTE	NOITE	2025-09-11 19:39:20.700745	f	19:39:20.700745	2025-09-11	\N	2025-10-30 18:24:45.818716
54	1	Rafael	ESTUDANTE	NOITE	2025-09-11 19:53:11.997978	t	19:53:11.997978	2025-09-11	\N	2025-10-30 18:24:45.818716
55	1	Rafael	ESTUDANTE	NOITE	2025-09-11 19:53:25.731551	f	19:53:25.731551	2025-09-11	\N	2025-10-30 18:24:45.818716
56	1	Rafael	ESTUDANTE	NOITE	2025-09-11 19:55:05.797485	t	19:55:05.797485	2025-09-11	\N	2025-10-30 18:24:45.818716
57	1	Rafael	ESTUDANTE	NOITE	2025-09-11 20:03:58.503195	f	20:03:58.503195	2025-09-11	\N	2025-10-30 18:24:45.818716
58	1	Rafael	ESTUDANTE	TARDE	2025-09-23 14:30:57.490585	t	14:30:57.490585	2025-09-23	\N	2025-10-30 18:24:45.818716
59	1	Rafael	ESTUDANTE	TARDE	2025-09-23 14:31:10.220882	f	14:31:10.220882	2025-09-23	\N	2025-10-30 18:24:45.818716
60	1	Rafael	ESTUDANTE	TARDE	2025-09-23 14:36:47.025066	t	14:36:47.025066	2025-09-23	\N	2025-10-30 18:24:45.818716
61	1	Rafael	ESTUDANTE	TARDE	2025-09-23 14:58:20.849974	f	14:58:20.849974	2025-09-23	\N	2025-10-30 18:24:45.818716
62	1	Rafael	ESTUDANTE	TARDE	2025-09-23 15:07:56.808894	t	15:07:56.808894	2025-09-23	\N	2025-10-30 18:24:45.818716
70	1	Rafael	ESTUDANTE	TARDE	2025-09-23 15:54:13.011497	f	15:54:13.011497	2025-09-23	\N	2025-10-30 18:24:45.818716
75	1	Rafael	ESTUDANTE	TARDE	2025-09-23 16:14:11.997496	t	16:14:11.997496	2025-09-23	\N	2025-10-30 18:24:45.818716
76	1	Rafael	ESTUDANTE	TARDE	2025-09-23 16:14:18.621407	f	16:14:18.621407	2025-09-23	\N	2025-10-30 18:24:45.818716
77	1	Rafael	ESTUDANTE	TARDE	2025-09-23 16:14:40.022072	t	16:14:40.022072	2025-09-23	\N	2025-10-30 18:24:45.818716
78	1	Rafael	ESTUDANTE	TARDE	2025-09-23 16:15:13.90929	f	16:15:13.90929	2025-09-23	\N	2025-10-30 18:24:45.818716
92	38	Pora	FUNCIONARIO	TARDE	2025-09-29 15:48:55.567092	f	15:48:55.567092	2025-09-29	\N	2025-10-30 18:24:45.818716
93	38	Pora	FUNCIONARIO	TARDE	2025-09-29 15:49:18.161656	t	15:49:18.161656	2025-09-29	\N	2025-10-30 18:24:45.818716
99	38	Pora	FUNCIONARIO	TARDE	2025-09-29 15:52:43.125563	f	15:52:43.125563	2025-09-29	\N	2025-10-30 18:24:45.818716
102	38	Pora	FUNCIONARIO	TARDE	2025-09-29 16:02:00.191648	t	16:02:00.191648	2025-09-29	45658	2025-10-30 18:24:45.818716
104	38	Pora	FUNCIONARIO	TARDE	2025-09-29 16:02:33.113544	f	16:02:33.113544	2025-09-29	45658	2025-10-30 18:24:45.818716
105	38	Pora	FUNCIONARIO	TARDE	2025-09-29 16:09:05.956342	t	16:09:05.956342	2025-09-29	45658	2025-10-30 18:24:45.818716
106	38	Pora	FUNCIONARIO	TARDE	2025-09-29 16:42:12.220947	f	16:42:12.220947	2025-09-29	45658	2025-10-30 18:24:45.818716
107	41	Gabriel San	FUNCIONARIO	TARDE	2025-10-07 17:02:24.991414	f	17:02:24.991414	2025-10-07	56645	2025-10-30 18:24:45.818716
108	41	Gabriel San	FUNCIONARIO	TARDE	2025-10-07 17:04:24.817157	t	17:04:24.817157	2025-10-07	56645	2025-10-30 18:24:45.818716
109	43	Rafael	FUNCIONARIO	TARDE	2025-10-09 13:07:26.835432	f	13:07:26.835432	2025-10-09	12345	2025-10-30 18:24:45.818716
110	43	Rafael	FUNCIONARIO	TARDE	2025-10-09 15:23:06.054705	t	15:23:06.054705	2025-10-09	12345	2025-10-30 18:24:45.818716
111	44	Renato	FUNCIONARIO	NOITE	2025-10-09 20:13:33.975705	f	20:13:33.975705	2025-10-09	13770	2025-10-30 18:24:45.818716
112	44	Renato	FUNCIONARIO	NOITE	2025-10-09 20:13:52.071624	t	20:13:52.071624	2025-10-09	13770	2025-10-30 18:24:45.818716
113	41	Gabriel San	FUNCIONARIO	NOITE	2025-10-09 20:21:12.686037	f	20:21:12.686037	2025-10-09	56645	2025-10-30 18:24:45.818716
114	38	Pora	FUNCIONARIO	TARDE	2025-10-10 14:41:51.676452	t	14:41:51.676452	2025-10-10	45658	2025-10-30 18:24:45.818716
115	38	Pora	FUNCIONARIO	TARDE	2025-10-10 14:42:04.82126	f	14:42:04.82126	2025-10-10	45658	2025-10-30 18:24:45.818716
116	38	Pora	FUNCIONARIO	TARDE	2025-10-10 14:43:19.497204	t	14:43:19.497204	2025-10-10	45658	2025-10-30 18:24:45.818716
117	38	Pora	FUNCIONARIO	TARDE	2025-10-10 14:43:33.264472	f	14:43:33.264472	2025-10-10	45658	2025-10-30 18:24:45.818716
118	45	Salgado	FUNCIONARIO	TARDE	2025-10-10 15:51:11.216997	f	15:51:11.216997	2025-10-10	11111	2025-10-30 18:24:45.818716
119	38	Pora	FUNCIONARIO	TARDE	2025-10-10 15:51:41.3062	t	15:51:41.3062	2025-10-10	45658	2025-10-30 18:24:45.818716
121	38	Pora	FUNCIONARIO	TARDE	2025-10-10 16:00:24.349019	f	16:00:24.349019	2025-10-10	45658	2025-10-30 18:24:45.818716
122	38	Pora	FUNCIONARIO	TARDE	2025-10-10 16:01:39.750825	t	16:01:39.750825	2025-10-10	45658	2025-10-30 18:24:45.818716
123	55	Teste	FUNCIONARIO	TARDE	2025-10-14 16:06:04.976757	f	16:06:04.976757	2025-10-14	78563	2025-10-30 18:24:45.818716
124	38	Pora	FUNCIONARIO	TARDE	2025-10-14 16:15:36.007993	f	16:15:36.007993	2025-10-14	45658	2025-10-30 18:24:45.818716
125	43	Rafael	FUNCIONARIO	NOITE	2025-10-14 19:30:14.475725	f	19:30:14.475725	2025-10-14	12345	2025-10-30 18:24:45.818716
126	38	Pora	FUNCIONARIO	TARDE	2025-10-16 15:35:56.740846	t	15:35:56.740846	2025-10-16	45658	2025-10-30 18:24:45.818716
127	38	Pora	FUNCIONARIO	TARDE	2025-10-16 17:03:51.946629	f	17:03:51.946629	2025-10-16	45658	2025-10-30 18:24:45.818716
128	41	Gabriel San	FUNCIONARIO	TARDE	2025-10-17 15:04:28.223894	t	15:04:28.223894	2025-10-17	56645	2025-10-30 18:24:45.818716
129	41	Gabriel San	FUNCIONARIO	TARDE	2025-10-17 15:04:42.487243	f	15:04:42.487243	2025-10-17	56645	2025-10-30 18:24:45.818716
130	43	Rafael	FUNCIONARIO	TARDE	2025-10-17 15:04:52.414154	t	15:04:52.414154	2025-10-17	12345	2025-10-30 18:24:45.818716
131	41	Gabriel San	FUNCIONARIO	TARDE	2025-10-17 15:10:45.037148	t	15:10:45.037148	2025-10-17	56645	2025-10-30 18:24:45.818716
132	43	Rafael	FUNCIONARIO	TARDE	2025-10-17 15:11:01.834236	f	15:11:01.834236	2025-10-17	12345	2025-10-30 18:24:45.818716
133	41	Gabriel San	FUNCIONARIO	TARDE	2025-10-17 15:11:35.892217	f	15:11:35.892217	2025-10-17	56645	2025-10-30 18:24:45.818716
134	41	Gabriel San	FUNCIONARIO	TARDE	2025-10-17 15:13:09.01257	t	15:13:09.01257	2025-10-17	56645	2025-10-30 18:24:45.818716
135	43	Rafael	FUNCIONARIO	TARDE	2025-10-17 15:13:36.043168	t	15:13:36.043168	2025-10-17	12345	2025-10-30 18:24:45.818716
136	43	Rafael	FUNCIONARIO	TARDE	2025-10-17 15:15:34.669458	f	15:15:34.669458	2025-10-17	12345	2025-10-30 18:24:45.818716
137	38	Pora	FUNCIONARIO	TARDE	2025-10-17 15:18:30.437933	t	15:18:30.437933	2025-10-17	45658	2025-10-30 18:24:45.818716
138	41	Gabriel San	FUNCIONARIO	TARDE	2025-10-17 15:21:50.598324	f	15:21:50.598324	2025-10-17	56645	2025-10-30 18:24:45.818716
139	41	Gabriel San	FUNCIONARIO	TARDE	2025-10-17 15:30:06.971606	t	15:30:06.971606	2025-10-17	56645	2025-10-30 18:24:45.818716
140	46	Sla	ESTUDANTE	TARDE	2025-10-17 15:37:03.089544	f	15:37:03.089544	2025-10-17	1235689789125	2025-10-30 18:24:45.818716
141	60	Alegre	FUNCIONARIO	TARDE	2025-10-17 16:58:51.508339	f	16:58:51.508339	2025-10-17	45632	2025-10-30 18:24:45.818716
142	61	Gabriel Advogado	ESTUDANTE	TARDE	2025-10-17 17:13:08.535321	f	17:13:08.535321	2025-10-17	7894561237894	2025-10-30 18:24:45.818716
143	38	Pora	FUNCIONARIO	TARDE	2025-10-17 17:23:42.529826	f	17:23:42.529826	2025-10-17	45658	2025-10-30 18:24:45.818716
144	38	Pora	FUNCIONARIO	TARDE	2025-10-17 17:24:35.897205	t	17:24:35.897205	2025-10-17	45658	2025-10-30 18:24:45.818716
146	41	Gabriel San	FUNCIONARIO	TARDE	2025-10-30 15:11:02.124579	f	15:11:02.124579	2025-10-30	56645	2025-10-30 18:24:45.818716
148	41	Gabriel San	FUNCIONARIO	TARDE	2025-10-30 15:17:06.913659	t	15:17:06.913659	2025-10-30	56645	2025-10-30 18:24:45.818716
149	66	Allan	VISITANTE	TARDE	2025-10-30 15:21:15.31398	f	15:21:15.31398	2025-10-30	591374387	2025-10-30 18:24:45.818716
150	66	Allan	VISITANTE	TARDE	2025-10-30 15:21:48.307046	t	15:21:48.307046	2025-10-30	591374387	2025-10-30 18:24:45.818716
151	41	Gabriel San	FUNCIONARIO	TARDE	2025-10-30 16:45:42.591756	f	16:45:42.591756	2025-10-30	56645	2025-10-30 18:24:45.818716
152	41	Gabriel San	FUNCIONARIO	NOITE	2025-10-30 19:01:26.433327	t	19:01:26.433327	2025-10-30	56645	2025-10-30 19:01:26.433327
153	41	Gabriel San	FUNCIONARIO	NOITE	2025-10-30 19:02:52.869335	f	19:02:52.869335	2025-10-30	56645	2025-10-30 19:02:52.869335
154	45	Salgado	FUNCIONARIO	TARDE	2025-11-03 14:05:31.155384	t	14:05:31.155384	2025-11-03	11111	2025-11-03 14:05:31.155384
155	60	Alegre	FUNCIONARIO	TARDE	2025-11-03 14:40:37.705805	t	14:40:37.705805	2025-11-03	45632	2025-11-03 14:40:37.705805
156	60	Alegre	FUNCIONARIO	TARDE	2025-11-03 14:40:57.403066	f	14:40:57.403066	2025-11-03	45632	2025-11-03 14:40:57.403066
157	60	Alegre	FUNCIONARIO	TARDE	2025-11-03 14:41:11.398324	t	14:41:11.398324	2025-11-03	45632	2025-11-03 14:41:11.398324
158	60	Alegre	FUNCIONARIO	TARDE	2025-11-03 14:41:55.486994	f	14:41:55.486994	2025-11-03	45632	2025-11-03 14:41:55.486994
159	60	Alegre	FUNCIONARIO	TARDE	2025-11-03 15:20:16.647539	t	15:20:16.647539	2025-11-03	45632	2025-11-03 15:20:16.647539
160	60	Alegre	FUNCIONARIO	TARDE	2025-11-03 15:58:41.248628	f	15:58:41.248628	2025-11-03	45632	2025-11-03 15:58:41.248628
161	60	Alegre	FUNCIONARIO	TARDE	2025-11-03 16:06:36.965802	t	16:06:36.965802	2025-11-03	45632	2025-11-03 16:06:36.965802
162	60	Alegre	FUNCIONARIO	TARDE	2025-11-03 16:08:20.109515	f	16:08:20.109515	2025-11-03	45632	2025-11-03 16:08:20.109515
163	60	Alegre	FUNCIONARIO	TARDE	2025-11-03 16:09:12.854416	t	16:09:12.854416	2025-11-03	45632	2025-11-03 16:09:12.854416
164	60	Alegre	FUNCIONARIO	TARDE	2025-11-03 16:09:42.63496	f	16:09:42.63496	2025-11-03	45632	2025-11-03 16:09:42.63496
165	60	Alegre	FUNCIONARIO	TARDE	2025-11-03 16:46:44.602809	t	16:46:44.602809	2025-11-03	45632	2025-11-03 16:46:44.602809
166	60	Alegre	FUNCIONARIO	TARDE	2025-11-03 17:22:23.265148	f	17:22:23.265148	2025-11-03	45632	2025-11-03 17:22:23.265148
167	60	Alegre	FUNCIONARIO	TARDE	2025-11-03 17:22:38.794579	t	17:22:38.794579	2025-11-03	45632	2025-11-03 17:22:38.794579
168	60	Alegre	FUNCIONARIO	TARDE	2025-11-03 17:24:12.442486	f	17:24:12.442486	2025-11-03	45632	2025-11-03 17:24:12.442486
169	66	Allan	VISITANTE	TARDE	2025-11-03 17:25:19.752378	f	17:25:19.752378	2025-11-03	591374387	2025-11-03 17:25:19.752378
170	60	Alegre	FUNCIONARIO	TARDE	2025-11-03 17:28:35.493525	t	17:28:35.493525	2025-11-03	45632	2025-11-03 17:28:35.493525
171	61	Gabriel Advogado	ESTUDANTE	TARDE	2025-11-03 17:28:56.706948	t	17:28:56.706948	2025-11-03	7894561237894	2025-11-03 17:28:56.706948
172	60	Alegre	FUNCIONARIO	TARDE	2025-11-03 17:29:06.927296	f	17:29:06.927296	2025-11-03	45632	2025-11-03 17:29:06.927296
173	61	Gabriel Advogado	ESTUDANTE	TARDE	2025-11-03 17:31:04.361037	f	17:31:04.361037	2025-11-03	7894561237894	2025-11-03 17:31:04.361037
174	61	Gabriel Advogado	ESTUDANTE	TARDE	2025-11-03 17:32:48.881093	t	17:32:48.881093	2025-11-03	7894561237894	2025-11-03 17:32:48.881093
175	61	Gabriel Advogado	ESTUDANTE	TARDE	2025-11-03 17:33:11.10359	f	17:33:11.10359	2025-11-03	7894561237894	2025-11-03 17:33:11.10359
176	61	Gabriel Advogado	ESTUDANTE	TARDE	2025-11-03 17:34:00.25561	t	17:34:00.25561	2025-11-03	7894561237894	2025-11-03 17:34:00.25561
177	60	Alegre	FUNCIONARIO	TARDE	2025-11-03 17:45:01.293211	t	17:45:01.293211	2025-11-03	45632	2025-11-03 17:45:01.293211
178	60	Alegre	FUNCIONARIO	TARDE	2025-11-03 17:45:08.536348	f	17:45:08.536348	2025-11-03	45632	2025-11-03 17:45:08.536348
179	60	Alegre	FUNCIONARIO	TARDE	2025-11-03 17:45:25.39799	t	17:45:25.39799	2025-11-03	45632	2025-11-03 17:45:25.39799
180	60	Alegre	FUNCIONARIO	TARDE	2025-11-03 17:45:33.425227	f	17:45:33.425227	2025-11-03	45632	2025-11-03 17:45:33.425227
181	60	Alegre	FUNCIONARIO	TARDE	2025-11-03 17:45:47.519387	t	17:45:47.519387	2025-11-03	45632	2025-11-03 17:45:47.519387
182	60	Alegre	FUNCIONARIO	TARDE	2025-11-03 17:45:55.31151	f	17:45:55.31151	2025-11-03	45632	2025-11-03 17:45:55.31151
183	60	Alegre	FUNCIONARIO	TARDE	2025-11-03 17:46:02.751242	t	17:46:02.751242	2025-11-03	45632	2025-11-03 17:46:02.751242
184	60	Alegre	FUNCIONARIO	TARDE	2025-11-03 17:46:59.780702	f	17:46:59.780702	2025-11-03	45632	2025-11-03 17:46:59.780702
192	62	Gabrielsss	FUNCIONARIO	TARDE	2025-11-04 15:36:12.763278	f	15:36:12.763278	2025-11-04	47863	2025-11-04 15:36:12.763278
193	66	Allan	VISITANTE	TARDE	2025-11-05 18:34:21.011035	t	18:34:21.011035	2025-11-05	591374387	2025-11-05 18:34:21.011035
194	66	Allan	VISITANTE	NOITE	2025-11-05 19:32:39.056511	f	19:32:39.056511	2025-11-05	591374387	2025-11-05 19:32:39.056511
195	66	Allan	VISITANTE	NOITE	2025-11-06 15:15:24.991474	t	15:15:24.991474	2025-11-06	591374387	2025-11-06 15:15:24.991474
196	66	Allan	VISITANTE	NOITE	2025-11-06 15:17:07.074205	f	15:17:07.074205	2025-11-06	591374387	2025-11-06 15:17:07.074205
197	66	Allan	VISITANTE	NOITE	2025-11-06 15:17:56.924173	t	15:17:56.924173	2025-11-06	591374387	2025-11-06 15:17:56.924173
198	66	Allan	VISITANTE	NOITE	2025-11-06 15:25:18.170717	f	15:25:18.170717	2025-11-06	591374387	2025-11-06 15:25:18.170717
199	66	Allan	VISITANTE	NOITE	2025-11-06 15:26:12.410901	t	15:26:12.410901	2025-11-06	591374387	2025-11-06 15:26:12.410901
200	66	Allan	VISITANTE	NOITE	2025-11-06 15:26:52.817159	f	15:26:52.817159	2025-11-06	591374387	2025-11-06 15:26:52.817159
201	66	Allan	VISITANTE	NOITE	2025-11-06 15:27:21.95389	t	15:27:21.95389	2025-11-06	591374387	2025-11-06 15:27:21.95389
202	66	Allan	VISITANTE	NOITE	2025-11-14 12:21:57.285865	f	12:21:57.285865	2025-11-14	591374387	2025-11-14 12:21:57.285865
203	61	Gabriel Advogado	ESTUDANTE	NOITE	2025-11-14 12:22:25.06703	f	12:22:25.06703	2025-11-14	7894561237894	2025-11-14 12:22:25.06703
204	61	Gabriel Advogado	ESTUDANTE	NOITE	2025-11-14 12:22:58.906643	t	12:22:58.906643	2025-11-14	7894561237894	2025-11-14 12:22:58.906643
205	66	Allan	VISITANTE	NOITE	2025-11-14 12:27:22.708048	t	12:27:22.708048	2025-11-14	591374387	2025-11-14 12:27:22.708048
206	66	Allan	VISITANTE	NOITE	2025-11-14 12:28:02.981091	f	12:28:02.981091	2025-11-14	591374387	2025-11-14 12:28:02.981091
207	66	Allan	VISITANTE	NOITE	2025-11-14 12:28:40.887646	t	12:28:40.887646	2025-11-14	591374387	2025-11-14 12:28:40.887646
208	66	Allan	VISITANTE	NOITE	2025-11-14 12:29:03.511198	f	12:29:03.511198	2025-11-14	591374387	2025-11-14 12:29:03.511198
209	66	Allan	VISITANTE	NOITE	2025-11-14 12:33:00.816819	t	12:33:00.816819	2025-11-14	591374387	2025-11-14 12:33:00.816819
210	66	Allan	VISITANTE	NOITE	2025-11-14 12:45:01.719526	f	12:45:01.719526	2025-11-14	591374387	2025-11-14 12:45:01.719526
211	66	Allan	VISITANTE	NOITE	2025-11-14 12:53:26.607491	t	12:53:26.607491	2025-11-14	591374387	2025-11-14 12:53:26.607491
212	66	Allan	VISITANTE	NOITE	2025-11-14 12:54:46.010262	f	12:54:46.010262	2025-11-14	591374387	2025-11-14 12:54:46.010262
213	66	Allan	VISITANTE	NOITE	2025-11-14 12:54:58.068703	t	12:54:58.068703	2025-11-14	591374387	2025-11-14 12:54:58.068703
214	66	Allan	VISITANTE	NOITE	2025-11-14 12:55:37.408267	f	12:55:37.408267	2025-11-14	591374387	2025-11-14 12:55:37.408267
215	66	Allan	VISITANTE	NOITE	2025-11-14 14:13:04.251239	t	14:13:04.251239	2025-11-14	591374387	2025-11-14 14:13:04.251239
216	66	Allan	VISITANTE	NOITE	2025-11-14 18:22:32.670288	f	18:22:32.670288	2025-11-14	591374387	2025-11-14 18:22:32.670288
217	66	Allan	VISITANTE	NOITE	2025-11-14 18:22:46.505791	t	18:22:46.505791	2025-11-14	591374387	2025-11-14 18:22:46.505791
218	66	Allan	VISITANTE	NOITE	2025-11-14 18:23:05.102164	f	18:23:05.102164	2025-11-14	591374387	2025-11-14 18:23:05.102164
219	66	Allan	VISITANTE	NOITE	2025-11-14 18:23:54.529139	t	18:23:54.529139	2025-11-14	591374387	2025-11-14 18:23:54.529139
220	66	Allan	VISITANTE	NOITE	2025-11-14 18:24:06.06185	f	18:24:06.06185	2025-11-14	591374387	2025-11-14 18:24:06.06185
221	60	Alegre	FUNCIONARIO	TARDE	2025-11-19 16:12:30.721658	t	16:12:30.721658	2025-11-19	45632	2025-11-19 16:12:30.721658
222	60	Alegre	FUNCIONARIO	TARDE	2025-11-19 16:28:23.054204	f	16:28:23.054204	2025-11-19	45632	2025-11-19 16:28:23.054204
223	74	André	FUNCIONARIO	TARDE	2025-11-19 17:32:44.88531	f	17:32:44.88531	2025-11-19	14563	2025-11-19 17:32:44.88531
\.


--
-- Data for Name: portaria; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.portaria (id, usuario_id, matricula, senha, created_at) FROM stdin;
1	5	PORT001	$2a$06$lMgwMlXOfGUhXfVp496PxuNDTeLsMJW2Fvlako1BC7mfP1mpd/ZWi	2025-08-27 23:09:31.382015
2	65	46588	$2a$06$HWGT038Lk/J6e7ZAP3gyxeklcUfphicFvR/MgcBHsAf4AotaA.Vvi	2025-10-28 17:35:07.251404
\.


--
-- Data for Name: rh; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.rh (id, usuario_id, matricula, senha, created_at) FROM stdin;
1	56	RH001	$2a$06$jDJa.vzU78Bn8yDsro/nXOLgazv3lGNyMQhgag3JFwFMZEL5I3XJK	2025-10-14 17:07:16.076777
\.


--
-- Data for Name: system_changes; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.system_changes (id, table_name, last_change, change_count) FROM stdin;
1	log_entrada	2025-11-19 17:32:44.88531	72
\.


--
-- Data for Name: user_finger; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.user_finger (user_id, template_position) FROM stdin;
60	0
66	1
74	2
\.


--
-- Data for Name: usuario; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.usuario (id, nome, tipo, created_at, updated_at, identificador, imagem_path) FROM stdin;
1	Administrador Sistema	ADMIN	2025-08-27 23:09:31.359962	2025-08-27 23:09:31.359962	\N	\N
5	Carlos Portaria	PORTARIA	2025-08-27 23:09:31.376951	2025-08-27 23:09:31.376951	\N	\N
66	Allan	VISITANTE	2025-10-30 15:14:55.807439	2025-11-19 17:06:58.149473	591374387	assets/users/591374387.jpg
55	Teste	FUNCIONARIO	2025-10-14 15:56:36.616611	2025-10-14 15:56:36.663824	78563	assets/users/78563.jpg
46	Sla	ESTUDANTE	2025-10-13 17:26:09.443759	2025-10-17 15:36:46.354187	1235689789125	assets/users/1235689789125.jpg
74	André	FUNCIONARIO	2025-11-14 14:09:08.875251	2025-11-19 17:32:30.945832	14563	assets/users/14563.jpg
44	Renato	FUNCIONARIO	2025-10-09 20:05:23.861455	2025-10-17 16:51:06.217976	13770	assets/users/13770.jpg
45	Salgado	FUNCIONARIO	2025-10-10 15:46:33.771291	2025-10-17 16:51:18.005865	11111	assets/users/11111.jpg
56	Recursos Humanos	RH	2025-10-14 17:06:13.032327	2025-10-14 17:06:13.032327	\N	\N
43	Rafael	FUNCIONARIO	2025-10-09 13:05:31.198511	2025-10-14 19:30:43.883411	12345	assets/users/12345.jpg
38	Pora	FUNCIONARIO	2025-09-23 14:54:35.50563	2025-10-17 17:23:06.69883	45658	assets/users/45658.jpg
63	Rod	FUNCIONARIO	2025-10-20 19:15:56.053721	2025-10-20 19:15:56.412751	14896	assets/users/14896.jpg
64	SALT	FUNCIONARIO	2025-10-21 21:40:59.233504	2025-10-21 21:40:59.233504	56542	\N
65	Allan	PORTARIA	2025-10-28 17:35:07.251404	2025-10-28 17:35:07.251404	46588	\N
67	SalgadoEstudante	ESTUDANTE	2025-10-31 17:57:35.873576	2025-10-31 18:07:55.774032	1235655965893	\N
62	Gabrielsss	FUNCIONARIO	2025-10-17 17:10:43.541517	2025-11-04 15:35:51.385184	47863	assets/users/47863.jpg
70	Pouzelli	FUNCIONARIO	2025-11-10 17:23:00.990062	2025-11-10 17:23:00.990062	98545	\N
72	LALALENDI	FUNCIONARIO	2025-11-10 18:01:57.95875	2025-11-10 18:01:57.95875	54236	\N
73	Marcelo	FUNCIONARIO	2025-11-14 11:08:01.268321	2025-11-14 11:08:01.268321	52689	\N
61	Gabriel Advogado	ESTUDANTE	2025-10-17 17:07:09.32308	2025-11-19 16:48:14.172096	7894561237894	assets/users/7894561237894.jpg
41	Gabriel San	FUNCIONARIO	2025-10-06 19:21:17.945333	2025-11-19 16:59:38.323371	56645	assets/users/56645.jpg
60	Alegre	FUNCIONARIO	2025-10-17 16:57:24.965193	2025-11-19 17:04:36.279922	45632	assets/users/45632.jpg
\.


--
-- Name: admin_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.admin_id_seq', 1, true);


--
-- Name: log_entrada_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.log_entrada_id_seq', 223, true);


--
-- Name: log_id_log_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.log_id_log_seq', 503, true);


--
-- Name: portaria_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.portaria_id_seq', 2, true);


--
-- Name: rh_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.rh_id_seq', 1, true);


--
-- Name: system_changes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.system_changes_id_seq', 1, true);


--
-- Name: usuario_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.usuario_id_seq', 74, true);


--
-- Name: admin admin_id_admin_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admin
    ADD CONSTRAINT admin_id_admin_key UNIQUE (id_admin);


--
-- Name: admin admin_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admin
    ADD CONSTRAINT admin_pkey PRIMARY KEY (id);


--
-- Name: admin admin_usuario_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admin
    ADD CONSTRAINT admin_usuario_id_key UNIQUE (usuario_id);


--
-- Name: log_entrada log_entrada_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.log_entrada
    ADD CONSTRAINT log_entrada_pkey PRIMARY KEY (id);


--
-- Name: log log_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.log
    ADD CONSTRAINT log_pkey PRIMARY KEY (id_log);


--
-- Name: portaria portaria_matricula_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.portaria
    ADD CONSTRAINT portaria_matricula_key UNIQUE (matricula);


--
-- Name: portaria portaria_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.portaria
    ADD CONSTRAINT portaria_pkey PRIMARY KEY (id);


--
-- Name: portaria portaria_usuario_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.portaria
    ADD CONSTRAINT portaria_usuario_id_key UNIQUE (usuario_id);


--
-- Name: rh rh_matricula_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rh
    ADD CONSTRAINT rh_matricula_key UNIQUE (matricula);


--
-- Name: rh rh_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rh
    ADD CONSTRAINT rh_pkey PRIMARY KEY (id);


--
-- Name: rh rh_usuario_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rh
    ADD CONSTRAINT rh_usuario_id_key UNIQUE (usuario_id);


--
-- Name: system_changes system_changes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.system_changes
    ADD CONSTRAINT system_changes_pkey PRIMARY KEY (id);


--
-- Name: system_changes system_changes_table_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.system_changes
    ADD CONSTRAINT system_changes_table_name_key UNIQUE (table_name);


--
-- Name: user_finger user_finger_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_finger
    ADD CONSTRAINT user_finger_pkey PRIMARY KEY (user_id);


--
-- Name: user_finger user_finger_template_position_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_finger
    ADD CONSTRAINT user_finger_template_position_key UNIQUE (template_position);


--
-- Name: usuario usuario_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.usuario
    ADD CONSTRAINT usuario_pkey PRIMARY KEY (id);


--
-- Name: idx_admin_id_admin; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_admin_id_admin ON public.admin USING btree (id_admin);


--
-- Name: idx_log_usuario; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_log_usuario ON public.log USING btree (id_usuario);


--
-- Name: idx_portaria_matricula; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_portaria_matricula ON public.portaria USING btree (matricula);


--
-- Name: idx_usuario_tipo; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_usuario_tipo ON public.usuario USING btree (tipo);


--
-- Name: log_entrada log_entrada_notify_trigger; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER log_entrada_notify_trigger AFTER INSERT ON public.log_entrada FOR EACH ROW EXECUTE FUNCTION public.notify_new_entry();


--
-- Name: log_entrada trg_auto_controle; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_auto_controle BEFORE INSERT ON public.log_entrada FOR EACH ROW EXECUTE FUNCTION public.auto_determinar_controle();


--
-- Name: usuario update_usuario_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_usuario_updated_at BEFORE UPDATE ON public.usuario FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: admin admin_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admin
    ADD CONSTRAINT admin_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuario(id) ON DELETE CASCADE;


--
-- Name: log_entrada log_entrada_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.log_entrada
    ADD CONSTRAINT log_entrada_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuario(id) ON DELETE CASCADE;


--
-- Name: portaria portaria_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.portaria
    ADD CONSTRAINT portaria_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuario(id) ON DELETE CASCADE;


--
-- Name: rh rh_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rh
    ADD CONSTRAINT rh_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuario(id) ON DELETE CASCADE;


--
-- Name: user_finger user_finger_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_finger
    ADD CONSTRAINT user_finger_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.usuario(id);


--
-- PostgreSQL database dump complete
--

\unrestrict 9EK5YaFgWVvBhkhtEEkrgQ94eONgafhJdGsC1sP0XEXFRYJshmCkHxNSj62288i

